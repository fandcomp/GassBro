import cron from 'node-cron';
import dayjs from 'dayjs';
import { generateDailySummary, evaluateDay } from './planner.js';
import { recentMemory, remember } from './memory.js';
import { buildReflectionPrompt, callLLM } from '../services/llm.js';
import { insertReflection } from '../services/supabase.js';
import { exposedFunctions } from '../services/agentFunctions.js';
import { sendTelegram } from '../services/telegram.js';
import { supabase } from '../services/supabase.js';

async function morningRoutine() {
  const today = dayjs().format('YYYY-MM-DD');
  const summary = await generateDailySummary(today);
  await sendTelegram(`Daily Summary ${today}\nTugas: ${summary.tasks_count}\nEvents: ${summary.events_count}\nFokus: ${summary.focus_recommendation}`);
}

async function eveningRoutine() {
  const today = dayjs().format('YYYY-MM-DD');
  const evaluation = await evaluateDay(today);
  await sendTelegram(`Evaluasi ${today}\nProgress: ${evaluation.completed_ratio}\nRekomendasi: ${evaluation.recommendations}`);
}

async function deadlineReminderRoutine() {
  const now = dayjs();
  const in30 = now.add(30, 'minute');
  const { data: tasks, error } = await supabase.from('tasks')
    .select('*')
    .in('status',['pending','in_progress'])
    .not('deadline','is', null)
    .gte('deadline', now.toISOString())
    .lte('deadline', in30.toISOString());
  if (error) return;
  for (const t of tasks) {
    await sendTelegram(`Reminder: *${t.title}* deadline jam ${dayjs(t.deadline).format('HH:mm')}`);
  }
}

console.log('[scheduler] starting schedules');
cron.schedule('0 7 * * *', () => morningRoutine());
cron.schedule('*/5 * * * *', () => deadlineReminderRoutine());
cron.schedule('0 21 * * *', () => eveningRoutine());
// Midday adaptive re-focus at 12:05
cron.schedule('5 12 * * *', async ()=>{
  try {
    const focus = await exposedFunctions.focus_today();
    const auto = await exposedFunctions.auto_schedule_top_tasks({ count:2 });
    await sendTelegram(`Refokus Siang: ${focus.top.map(t=>t.title||t.id).join(', ')}\nBlok baru: ${auto.scheduled.length}`);
  } catch(e){ console.warn('[scheduler] midday error', e.message); }
});
// Afternoon stagnation scan 15:30
cron.schedule('30 15 * * *', async ()=>{
  try {
    const stale = await exposedFunctions.detect_stagnant_tasks({ hours:48 });
    if (stale.count) {
      await sendTelegram(`Stagnant (${stale.count}) contoh: ${stale.tasks.slice(0,3).map(t=>t.title).join(', ')}`);
    }
  } catch(e){ console.warn('[scheduler] stagnation error', e.message); }
});
// Night reflection at 21:05 (after evaluation at 21:00)
cron.schedule('5 21 * * *', async ()=>{
  try {
    const recent = await recentMemory(80);
    const lines = recent.filter(m=> ['user','action'].includes(m.role)).slice(-20).map(m=>{
      if (m.role==='user') return 'U:'+ (m.content||'').slice(0,80);
      if (m.role==='action') return 'A:'+ (m.action?.action||'');
      return '';
    }).filter(Boolean);
    const prompt = buildReflectionPrompt(lines);
    const raw = await callLLM(prompt, { temperature:0 });
    let reflection; try { reflection = JSON.parse(raw); } catch { reflection = { raw }; }
    const date = dayjs().format('YYYY-MM-DD');
    await insertReflection(date, reflection);
    await remember({ role:'system', content:'reflection_auto', result: reflection });
    // Auto-follow next_actions (whitelist only)
    const allowed = new Set(['prioritize_tasks','detect_stagnant_tasks','focus_today']);
    if (Array.isArray(reflection?.next_actions)){
      for (const act of reflection.next_actions.slice(0,2)){
        if (typeof act !== 'string') continue;
        const name = act.trim().split(/\s+/)[0];
        if (allowed.has(name) && exposedFunctions[name]){
          try { await exposedFunctions[name]({}); } catch(e){ /* ignore */ }
        }
      }
    }
    await sendTelegram('Refleksi malam tersimpan.');
  } catch(e){ console.warn('[scheduler] reflection error', e.message); }
});
