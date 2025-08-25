import axios from 'axios';
import { CONFIG } from '../env.js';
import { exposedFunctions } from './agentFunctions.js';
import { remember } from '../agent/memory.js';
import { callLLM, buildPlanningPrompt, planWithRetries } from './llm.js';
import { functionRegistry } from '../agent/functionRegistry.js';
import { parseIndoDateTime } from '../utils/nlp.js';
import dayjs from 'dayjs';

// Escape for Telegram MarkdownV2 (https://core.telegram.org/bots/api#markdownv2-style)
function escapeMarkdownV2(text='') {
  return text.replace(/([_*>\\[\\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export async function sendTelegram(message, chatIdOverride, { raw=false, markdown=false } = {}) {
  if (!CONFIG.telegramBotToken || (!CONFIG.telegramChatId && !chatIdOverride)) {
    console.warn('[telegram] token/chat id missing');
    return;
  }
  const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
  const chat_id = chatIdOverride || CONFIG.telegramChatId;
  try {
  // Use plain text by default to avoid parse errors; enable markdown flag explicitly if needed
  const payload = (raw || !markdown) ? { chat_id, text: String(message) } : { chat_id, text: escapeMarkdownV2(String(message)), parse_mode: 'MarkdownV2' };
  await axios.post(url, payload);
  } catch (e) {
  console.error('[telegram] error', e.response?.data || e.message, '-> retry plain text');
  // Fallback send plain text without parse_mode
  try { await axios.post(url, { chat_id, text: String(message) }); } catch {/* ignore final */}
  }
}

// Basic command parsing
function parseCommand(text){
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('/t ')) {
    return { type:'add_task', title: trimmed.slice(3).trim() };
  }
  if (trimmed === '/reset_tasks') return { type:'reset_tasks' };
  if (trimmed === '/reset_events') return { type:'reset_events' };
  if (trimmed === '/reset_goals') return { type:'reset_goals' };
  if (trimmed.startsWith('/e ')) {
    // /e Meeting besok 09:00-10:00
    const body = trimmed.slice(3).trim();
    const dt = parseIndoDateTime(body);
    // Heuristic title extraction: remove time ranges & date words but keep descriptive lead
    const original = body;
    const timePattern = /\b\d{1,2}[:.]\d{2}(?:\s*-\s*\d{1,2}[:.]\d{2})?/g;
    const dateWords = /\b(besok|lusa|hari ini|hari ini|today|tomorrow|minggu depan|nanti siang|nanti malam)\b/gi;
    let stripped = original.replace(timePattern,' ').replace(dateWords,' ').replace(/\s+/g,' ').trim();
    if (!stripped) {
      // Try substring before first time occurrence
      const m = original.match(timePattern);
      if (m && m.index > 0) stripped = original.slice(0, m.index).trim();
    }
    if (!stripped || stripped.length < 3) stripped = original.trim();
    // Final fallback
    if (!stripped || /^\d{1,2}[:.]/.test(stripped)) stripped = 'Event';
    return { type:'schedule_event', title: stripped, start: dt.start, end: dt.end };
  }
  if (trimmed.startsWith('/help')) {
    return { type:'help' };
  }
  return { type:'chat', text: trimmed };
}

export async function handleTelegramUpdate(update){
  try {
    const msg = update.message;
    if (!msg || !msg.text) return;
    const chatId = msg.chat.id;
    const cmd = parseCommand(msg.text);
    if (!cmd) return;
    if (cmd.type==='help') {
      return sendTelegram('Perintah:\n/t Judul task\n/e Judul event besok 09:00-10:00\nTeks biasa → agent reasoning', chatId);
    }
    if (cmd.type==='add_task') {
      const r = await exposedFunctions.add_task({ title: cmd.title });
      await remember({ role:'user', content: msg.text });
      await remember({ role:'action', action:{ action:'add_task', params:{ title: cmd.title }}, result:r });
      return sendTelegram(`✅ Task ditambahkan: ${r.title}`, chatId);
    }
    if (cmd.type==='schedule_event') {
      const r = await exposedFunctions.schedule_event({ title: cmd.title, datetime_start: cmd.start, datetime_end: cmd.end, force:true });
    if (cmd.type==='reset_tasks') {
      const r = await exposedFunctions.reset_all_tasks();
      return sendTelegram(`Tasks dihapus (${r.count}).`, chatId);
    }
    if (cmd.type==='reset_events') {
      const r = await exposedFunctions.reset_all_events();
      return sendTelegram(`Events dihapus (${r.count}).`, chatId);
    }
    if (cmd.type==='reset_goals') {
      const r = await exposedFunctions.reset_all_goals();
      return sendTelegram(`Goals dihapus (${r.count}).`, chatId);
    }
      await remember({ role:'user', content: msg.text });
      await remember({ role:'action', action:{ action:'schedule_event' }, result:r });
      return sendTelegram(`🗓 Event dibuat: ${cmd.title}\n${dayjs(cmd.start).format('DD/MM HH:mm')} - ${dayjs(cmd.end).format('HH:mm')}`, chatId);
    }
    // Fallback to agent planning for free text
    if (cmd.type==='chat') {
      await remember({ role:'user', content: cmd.text });
      // Heuristic bulk reset detection (natural language)
      const lower = cmd.text.toLowerCase();
      const bulkMap = [
        { rx: /(hapus|reset|bersihkan|clear).*(seluruh|semua|semuanya).*(task|tugas)|(hapus|reset|bersihkan|clear).*(task|tugas).*(seluruh|semua|semuanya)/, action:'reset_all_tasks', label:'Semua task telah dihapus' },
        { rx: /(hapus|reset|bersihkan|clear).*(seluruh|semua|semuanya).*(event|calendar|kalender|jadwal|schedule|calendar list)|(hapus|reset|bersihkan|clear).*(event|calendar|kalender|jadwal|schedule|calendar list).*(seluruh|semua|semuanya)/, action:'reset_all_events', label:'Semua event telah dihapus' },
        { rx: /(hapus|reset|bersihkan|clear).*(seluruh|semua|semuanya).*(goal|target)|(hapus|reset|bersihkan|clear).*(goal|target).*(seluruh|semua|semuanya)/, action:'reset_all_goals', label:'Semua goal telah dihapus' }
      ];
      const match = bulkMap.find(m=> m.rx.test(lower));
      if (match) {
        try {
          const fn = exposedFunctions[match.action];
          const r = await fn({});
          await remember({ role:'action', action:{ action: match.action }, result:r });
          return sendTelegram(`${match.label} (count: ${r.count||0})`, chatId);
        } catch(e){
          return sendTelegram('Gagal reset: '+ e.message, chatId);
        }
      }
      const planPrompt = buildPlanningPrompt(cmd.text, functionRegistry.filter(f=> exposedFunctions[f.name]), '');
      const planned = await planWithRetries(planPrompt, { maxRetries:1 });
      let intents = planned.intents || [];
      intents = intents.slice(0,3);
      const results = [];
      for (const it of intents){
        try { const fn = exposedFunctions[it.action]; if (!fn) continue; const data = await fn(it.params||{}); results.push({ action: it.action, ok:true }); await remember({ role:'action', action:it, result:data }); } catch(e){ results.push({ action: it.action, error:e.message }); }
      }
      const summary = results.length? results.map(r=> r.ok? '✔ '+r.action : '✖ '+r.action).join('\n') : 'Tidak ada aksi dieksekusi.';
      return sendTelegram(`Agent:\n${summary}`, chatId);
    }
  } catch(e){
    console.error('[telegram] handle error', e.message);
  }
}
