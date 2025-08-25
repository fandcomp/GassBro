import express from 'express';
import cors from 'cors';
import './env.js';
import { listCapabilities } from './agent/interpreter.js';
import { remember, recentMemory } from './agent/memory.js';
import { exposedFunctions } from './services/agentFunctions.js';
import { handleTelegramUpdate } from './services/telegram.js';
import { functionRegistry } from './agent/functionRegistry.js';
import { callLLM, buildPlanningPrompt, buildAnswerPrompt, planWithRetries, buildReflectionPrompt } from './services/llm.js';
import { parseIndoDateTime, classifyIntentHeuristic } from './utils/nlp.js';
import { describeNow, toTz } from './utils/time.js';
import { startPlan, updateIntentStatus, finalizePlan, getAgentSnapshot } from './agent/state.js';
function sanitizeIntents(rawText, intents){
  if (!Array.isArray(intents)) return [];
  const text = rawText.trim();
  const cleaned = [];
  // Alias mapping for model variants
  const aliasMap = {
    delete_all_events: 'reset_all_events',
    delete_all_tasks: 'reset_all_tasks',
    delete_all_goals: 'reset_all_goals'
  };
  let derivedTitle = null;
  // Try simple title extraction: take up to 5 words excluding stopwords
  const stop = new Set(['saya','tolong','buat','bikin','mohon','dong','yang','untuk','lagi','segera','please']);
  const words = text.split(/[^a-zA-Z0-9áéíóúàèìòùäëïöüâêîôûçñ\u00C0-\u024F]+/).filter(w=>w.length>0);
  const coreWords = words.filter(w=> !stop.has(w.toLowerCase()));
  if (coreWords.length){
    derivedTitle = coreWords.slice(0,5).join(' ');
  }
  for (const it of intents){
    if (!it || !it.action) continue;
  if (aliasMap[it.action]) it.action = aliasMap[it.action];
    const p = it.params || {};
    if (it.action === 'add_task'){
      if (!p.title || !String(p.title).trim()){
        if (derivedTitle) p.title = derivedTitle;
        else continue; // drop if still empty
      }
    }
    if (it.action === 'schedule_event'){
      if (!p.title || p.title.length < 3) p.title = derivedTitle || text;
      // Ensure datetime integrity
      if (!p.datetime_start || !p.datetime_end){
        const dt = parseIndoDateTime(text);
        p.datetime_start = dt.start; p.datetime_end = dt.end;
      }
    }
    if (it.action === 'schedule_recurring_event'){
      // try parse day names & time
      if (p.day_of_week === undefined){
        const lower = text.toLowerCase();
        const map = { minggu:0, senin:1, selasa:2, rabu:3, kamis:4, jumat:5, 'jumat':5, sabtu:6 };
        for (const k of Object.keys(map)) if (lower.includes(k)) { p.day_of_week = map[k]; break; }
      }
      if (!p.start_time_hhmm){ const m = text.match(/(\d{1,2}[:.]\d{2})/); if (m) p.start_time_hhmm = m[1].replace('.',':'); }
      if (!p.end_time_hhmm && p.start_time_hhmm){
        const [h] = p.start_time_hhmm.split(':'); const eh = (parseInt(h,10)+1)%24; p.end_time_hhmm = String(eh).padStart(2,'0')+':00';
      }
    }
    if (it.action === 'shift_next_event'){
      if (p.minutes === undefined){
        const m = text.match(/(maju|mundur|geser) *(\d{1,3}) *menit/);
        if (m){
          const val = parseInt(m[2],10);
          p.minutes = /mundur/.test(m[1]) ? -val : val;
        }
      }
    }
    if (it.action === 'auto_schedule_top_tasks'){
      if (p.count === undefined){ const m = text.match(/(\d+) *task/); if (m) p.count = parseInt(m[1],10); }
    }
    cleaned.push({ action: it.action, params: p });
  }
  // Remove duplicate add_task with same title
  const seenTaskTitles = new Set();
  return cleaned.filter(it=>{
    if (it.action !== 'add_task') return true;
    const t = it.params.title.toLowerCase();
    if (seenTaskTitles.has(t)) return false;
    seenTaskTitles.add(t); return true;
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', async (req,res)=>{
  res.json({ name: 'GassBro Agent API', status: 'ok', functions: Object.keys(exposedFunctions), capabilities: listCapabilities(), llm: { model: process.env.OLLAMA_MODEL || 'llama3', url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate' } });
});
app.get('/health', (req,res)=> res.json({ ok:true, ts: Date.now() }));
app.get('/time', (req,res)=>{
  res.json(describeNow());
});

// Simple listing endpoints
app.get('/tasks', async (req,res)=>{
  try {
    const data = await exposedFunctions.list_tasks();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/tasks/:id', async (req,res)=>{
  try {
  console.log('PUT /tasks/:id', req.params.id, req.body);
    const task = await exposedFunctions.update_task({ task_id: req.params.id, ...req.body });
    res.json(task);
  } catch(e){ res.status(500).json({ error: e.message }); }
});
app.delete('/tasks/:id', async (req,res)=>{
  try {
  console.log('DELETE /tasks/:id', req.params.id);
    const result = await exposedFunctions.delete_task({ task_id: req.params.id });
    res.json(result);
  } catch(e){ console.error('ERR delete task', e); res.status(500).json({ error: e.message, stack: e.stack }); }
});
app.get('/events', async (req,res)=>{
  try {
    const data = await exposedFunctions.list_events();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/events/:id', async (req,res)=>{
  try { const ev = await exposedFunctions.update_event({ event_id: req.params.id, ...req.body }); res.json(ev); }
  catch(e){ res.status(500).json({ error: e.message }); }
});
app.delete('/events/:id', async (req,res)=>{
  try { const r = await exposedFunctions.delete_event({ event_id: req.params.id }); res.json(r); }
  catch(e){ console.error('ERR delete event', e); res.status(500).json({ error: e.message, stack: e.stack }); }
});
app.get('/goals', async (req,res)=>{
  try { const data = await exposedFunctions.list_goals(); res.json(data); }
  catch(e){ res.status(500).json({ error: e.message }); }
});
app.put('/goals/:id', async (req,res)=>{
  try { const g = await exposedFunctions.update_goal({ goal_id: req.params.id, ...req.body }); res.json(g); }
  catch(e){ res.status(500).json({ error: e.message }); }
});
app.delete('/goals/:id', async (req,res)=>{
  try { const r = await exposedFunctions.delete_goal({ goal_id: req.params.id }); res.json(r); }
  catch(e){ console.error('ERR delete goal', e); res.status(500).json({ error: e.message, stack: e.stack }); }
});

app.post('/fn/:name', async (req,res)=>{
  const fn = exposedFunctions[req.params.name];
  if (!fn) return res.status(404).json({ error: 'Function not found'});
  try {
    const result = await fn(req.body || {});
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent endpoints
// Legacy endpoints disabled (kept for compatibility but now returns error)
app.post('/agent/interpret', (req,res)=> res.status(410).json({ error:'Use /agent/chat' }));
app.post('/agent/act', (req,res)=> res.status(410).json({ error:'Use /agent/chat' }));

// Unified chat endpoint using LLM planning + execution
app.post('/agent/chat', async (req,res)=>{
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error:'Missing text'});
  await remember({ role:'user', content:text });
  // Early heuristic: bulk reset commands (skip LLM planning)
  const lower = text.toLowerCase();
  const bulkMap = [
  // order variant: verb ... quantifier ... object OR verb ... object ... quantifier
  { rx: /(hapus|reset).*(seluruh|semua|semuanya).*(task|tugas)|(hapus|reset).*(task|tugas).*(seluruh|semua|semuanya)/, action:'reset_all_tasks', label:'Semua task telah dihapus.' },
  { rx: /(hapus|reset).*(seluruh|semua|semuanya).*(event|calendar|kalender|jadwal|schedule|calendar list)|(hapus|reset).*(event|calendar|kalender|jadwal|schedule|calendar list).*(seluruh|semua|semuanya)/, action:'reset_all_events', label:'Semua event telah dihapus.' },
  { rx: /(hapus|reset).*(seluruh|semua|semuanya).*(goal|target)|(hapus|reset).*(goal|target).*(seluruh|semua|semuanya)/, action:'reset_all_goals', label:'Semua goal telah dihapus.' }
  ];
  const matched = bulkMap.find(m=> m.rx.test(lower));
  if (matched) {
    try {
      const fn = exposedFunctions[matched.action];
      const r = await fn({});
      await remember({ role:'action', action:{ action: matched.action }, result:r });
      const answer = matched.label + ` (count: ${r.count||0})`;
      await remember({ role:'assistant', content:answer });
      return res.json({ answer });
    } catch(e){
      const msg = 'Gagal melakukan reset: '+ e.message;
      await remember({ role:'assistant', content: msg });
      return res.json({ answer: msg });
    }
  }
  // 1. Plan intents via LLM
  // Build memory context (recent 8 entries user+action compressed)
  const recent = await recentMemory(40);
  const memLines = recent.filter(m=> ['user','action'].includes(m.role)).slice(-8).map(m=>{
    if (m.role==='user') return 'U:'+ (m.content||'').slice(0,80);
    if (m.role==='action') return 'A:'+ (m.action?.action||'')+' -> '+ (m.result?.title||m.result?.ok||'');
    return '';
  }).filter(Boolean).join('\n');
  const planPrompt = buildPlanningPrompt(text, functionRegistry.filter(f=> exposedFunctions[f.name]), memLines);
  let intents = [];
  let planRaw='';
  const planned = await planWithRetries(planPrompt, { maxRetries:2 });
  planRaw = planned.raw;
  intents = planned.intents;
  if ((!planRaw || intents.length===0) && !planned.retries) {
    // Heuristic fallback
    const kind = classifyIntentHeuristic(text);
    if (kind === 'schedule_event'){
      const dt = parseIndoDateTime(text);
      intents.push({ action:'schedule_event', params:{ title: text, datetime_start: dt.start, datetime_end: dt.end } });
    } else if (kind === 'add_task') {
  if (text.trim()) intents.push({ action:'add_task', params:{ title: text } });
    }
  }
  // 2. Refinement: drop redundant / disallowed duplicates
  intents = Array.isArray(intents)? intents.filter((it,i,arr)=>{
    if (!it || !it.action) return false;
    // keep only first of these singletons
    const singleton = ['generate_daily_summary','evaluate_day','memory_summary'];
    if (singleton.includes(it.action)) {
      return arr.findIndex(o=>o && o.action===it.action) === i;
    }
    return true;
  }): [];
  // limit 5
  if (intents.length > 5) intents = intents.slice(0,5);
  // 3. Sanitize intents (fill missing mandatory params)
  intents = sanitizeIntents(text, intents);
  // Start plan state tracking
  const planState = startPlan(text, intents);
  // 4. Execute intents sequentially
  const results = [];
  for (const intent of intents){
    if (!intent?.action) continue;
    const fn = exposedFunctions[intent.action];
    if (!fn){ results.push({ action:intent.action, error:'Unknown action'}); continue; }
    try {
      updateIntentStatus(intent.action, it=>{ it.status='running'; });
      const r = await fn(intent.params||{});
      results.push({ action:intent.action, ok:true, data:r });
      updateIntentStatus(intent.action, it=>{ it.status='done'; it.result = r; });
      await remember({ role:'action', action:intent, result:r });
    } catch(e){
      results.push({ action:intent.action, error:e.message });
      updateIntentStatus(intent.action, it=>{ it.status='error'; it.error = e.message; });
      await remember({ role:'action', action:intent, result:{ error:e.message } });
    }
  }
  // 4b. Auto-handle schedule conflicts: re-schedule with suggestion if present
  for (const r of results){
    if (r.action === 'schedule_event' && r.data && r.data.conflict && r.data.suggestion){
      try {
        const suggest = r.data.suggestion;
        const fn = exposedFunctions['schedule_event'];
        const alt = await fn({ title: intents.find(i=>i.action==='schedule_event')?.params?.title || 'Event', datetime_start: suggest.datetime_start, datetime_end: suggest.datetime_end, force:true });
        r.data.auto_rescheduled = alt;
        r.data.conflict = false;
      } catch(e){
        r.data.auto_reschedule_error = e.message;
      }
    }
  }
  // 5. Natural answer
  let answer;
  if (!planRaw) {
    // Natural fallback answer
    if (results.find(r=>r.action==='schedule_event' && r.ok)) {
      const nowCtx = describeNow();
      answer = `Baik, sudah saya catat jadwalnya. (Waktu sekarang ${nowCtx.local_iso} ${nowCtx.timezone})`;
    } else if (results.find(r=>r.action==='add_task' && r.ok)) {
      const nowCtx = describeNow();
      answer = `Task sudah ditambahkan. (Sekarang ${nowCtx.local_iso}) Ada lagi?`;
    } else {
      answer = 'Maaf model belum aktif. Permintaanmu sudah saya terima.';
    }
  } else {
    const answerPrompt = buildAnswerPrompt(text, intents, results);
    const ansRaw = await callLLM(answerPrompt);
    answer = ansRaw || 'Selesai diproses.';
  }
  await remember({ role:'assistant', content:answer });
  finalizePlan();
  res.json({ answer });
});

app.get('/agent/memory', async (req,res)=>{
  const mem = await recentMemory(30);
  res.json(mem);
});

// Agent reflection (meta reasoning) endpoint
app.post('/agent/reflect', async (req,res)=>{
  try {
    const recent = await recentMemory(60);
    const lines = recent.filter(m=> ['user','action'].includes(m.role)).slice(-15).map(m=>{
      if (m.role==='user') return 'U:'+ (m.content||'').slice(0,60);
      if (m.role==='action') return 'A:'+ (m.action?.action||'')+' -> '+ (m.result?.ok?'ok': (m.result?.error?'err':'done'));
      return '';
    }).filter(Boolean);
    const prompt = buildReflectionPrompt(lines);
    const raw = await callLLM(prompt, { temperature:0 });
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
    await remember({ role:'system', content:'reflection', result: parsed });
    res.json({ reflection: parsed });
  } catch(e){ res.status(500).json({ error:e.message }); }
});

app.get('/agent/state', (req,res)=>{
  res.json(getAgentSnapshot());
});

// Explicit LLM-powered helper endpoints (optional direct access)
app.post('/ai/refine-title', async (req,res)=>{
  try { const { raw_title, style } = req.body||{}; const r = await exposedFunctions.refine_task_title({ raw_title, style }); res.json(r); }
  catch(e){ res.status(400).json({ error:e.message }); }
});
app.post('/ai/task-brief', async (req,res)=>{
  try { const { title } = req.body||{}; const r = await exposedFunctions.task_brief({ title }); res.json(r); }
  catch(e){ res.status(400).json({ error:e.message }); }
});
app.get('/ai/explain-priorities', async (req,res)=>{
  try { const r = await exposedFunctions.explain_priorities(); res.json(r); }
  catch(e){ res.status(500).json({ error:e.message }); }
});
app.get('/ai/plan-day', async (req,res)=>{
  try { const r = await exposedFunctions.plan_day(); res.json(r); }
  catch(e){ res.status(500).json({ error:e.message }); }
});

// Telegram webhook (set via BotFather or manual setWebhook). Endpoint: /telegram/webhook
app.post('/telegram/webhook', async (req,res)=>{
  try {
    await handleTelegramUpdate(req.body);
    res.json({ ok:true });
  } catch(e){
    res.status(500).json({ error:e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`GassBro API listening on :${PORT}`));
