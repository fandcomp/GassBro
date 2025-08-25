import { addTask, addSubTask, updateTaskStatus, updateTask, deleteTask, scheduleEvent, listAllTasks, listAllEvents, listGoals, addGoal, updateGoalProgress, updateGoal, deleteGoal, updateEvent, deleteEvent, listOpenTasks, listDoneTasks, listDailyEvaluations, listReflections, deleteAllTasks, deleteAllEvents, deleteAllGoals } from './supabase.js';
import { recentMemory, remember } from '../agent/memory.js';
import { sendTelegram } from './telegram.js';
import { generateDailySummary, evaluateDay } from '../agent/planner.js';
import dayjs from 'dayjs';
import { callLLM } from './llm.js';

export async function fn_add_task({ title, deadline, priority }) {
  if (!title || !String(title).trim()) {
    throw new Error('Judul task wajib diisi');
  }
  const task = await addTask({ title: String(title).trim(), deadline, priority });
  await sendTelegram(`Task ditambahkan: ${title}`);
  return task;
}
export async function fn_update_task_status({ task_id, status }) {
  if (!task_id || typeof task_id !== 'string' || !/^[0-9a-fA-F-]{8,}$/.test(task_id)) {
    throw new Error('task_id tidak valid');
  }
  const task = await updateTaskStatus(task_id, status);
  return task;
}
export async function fn_update_task({ task_id, title, deadline, priority }) {
  const task = await updateTask({ task_id, title, deadline, priority });
  return task;
}
export async function fn_delete_task({ task_id }) {
  return await deleteTask(task_id);
}
export async function fn_schedule_event({ title, datetime_start, datetime_end, force=false }) {
  // Conflict detection before insert
  const start = dayjs(datetime_start);
  const end = dayjs(datetime_end);
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) throw new Error('Waktu event tidak valid');
  if (!title || !String(title).trim()) title = 'Event';
  const durationMs = end.diff(start);
  const existing = await listAllEvents();
  const conflicts = existing.filter(ev => {
    const s = dayjs(ev.start_time); const e = dayjs(ev.end_time);
    return s.isBefore(end) && e.isAfter(start);
  });
  if (conflicts.length && !force) {
    // propose next available slot after last conflict
    const latestEnd = conflicts.reduce((m,ev)=> dayjs(ev.end_time).isAfter(m)? dayjs(ev.end_time): m, start);
    let newStart = latestEnd.add(5,'minute');
    // snap to next 15-min block
    const minute = newStart.minute();
    const snap = Math.ceil(minute/15)*15;
    newStart = newStart.minute(snap).second(0);
    const suggestion = { datetime_start: newStart.toISOString(), datetime_end: newStart.add(durationMs,'ms').toISOString() };
    return { conflict:true, conflicts, suggestion };
  }
  const ev = await scheduleEvent({ title, datetime_start:start.toISOString(), datetime_end:end.toISOString() });
  // Auto refine if generic
  let refinement = null;
  try {
    if (!ev.title || /^event$/i.test(ev.title.trim()) || ev.title.trim().length < 4) {
      refinement = await fn_refine_event_title({ event_id: ev.id });
      if (refinement?.new_title) {
        ev.title = refinement.new_title; // reflect refined title in immediate response
      }
    }
  } catch(e){ /* ignore refinement errors */ }
  return { conflict:false, event: ev, refinement };
}
// Recurring weekly event scheduler (next N weeks)
export async function fn_schedule_recurring_event({ day_of_week, start_time_hhmm, end_time_hhmm, weeks=4, title }) {
  // day_of_week: 0=minggu ... 6=sabtu
  if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) throw new Error('day_of_week 0-6');
  if (!start_time_hhmm || !end_time_hhmm) throw new Error('start_time_hhmm dan end_time_hhmm wajib');
  if (!title) title = 'Recurring Event';
  const [sh, sm='0'] = String(start_time_hhmm).split(':');
  const [eh, em='0'] = String(end_time_hhmm).split(':');
  const now = dayjs();
  // find next date matching day_of_week
  let first = now.startOf('day');
  while (first.day() !== day_of_week) first = first.add(1,'day');
  const created = [];
  for (let w=0; w<weeks; w++) {
    const d = first.add(w,'week');
    const start = d.hour(parseInt(sh,10)).minute(parseInt(sm,10)).second(0);
    const end = d.hour(parseInt(eh,10)).minute(parseInt(em,10)).second(0);
    if (end.isBefore(start)) continue; // skip invalid
    try {
      const ev = await scheduleEvent({ title, datetime_start: start.toISOString(), datetime_end: end.toISOString() });
      created.push(ev);
    } catch(e){ /* continue */ }
  }
  await remember({ role:'action', action:{ action:'schedule_recurring_event' }, result:{ count: created.length }});
  return { count: created.length, events: created };
}

// Shift earliest upcoming event by minutes (can be negative)
export async function fn_shift_next_event({ minutes }) {
  const mins = parseInt(minutes,10);
  if (isNaN(mins) || !minutes) throw new Error('minutes invalid');
  const events = await listAllEvents();
  const now = dayjs();
  const upcoming = events.find(ev => dayjs(ev.start_time).isAfter(now));
  if (!upcoming) return { message:'Tidak ada event mendatang.' };
  const newStart = dayjs(upcoming.start_time).add(mins,'minute');
  const newEnd = dayjs(upcoming.end_time).add(mins,'minute');
  const updated = await updateEvent({ event_id: upcoming.id, start_time: newStart.toISOString(), end_time: newEnd.toISOString() });
  await remember({ role:'action', action:{ action:'shift_next_event', params:{ minutes: mins }}, result:{ id: upcoming.id }});
  return { shifted: updated, minutes: mins };
}

// Auto schedule top tasks into free afternoon slots (simple heuristic)
export async function fn_auto_schedule_top_tasks({ count=2 }) {
  const tasks = (await listOpenTasks()).filter(t=> !t.deadline && !t.parent_task_id);
  if (!tasks.length) return { scheduled: [] };
  // reuse prioritize logic
  const prioritized = await fn_prioritize_tasks();
  const candidates = prioritized.filter(p=> tasks.find(t=>t.id===p.id)).slice(0,count);
  const events = await listAllEvents();
  const today = dayjs();
  const dayStart = today.hour(13).minute(0).second(0);
  const dayEnd = today.hour(18).minute(0).second(0);
  // Build occupied intervals
  const intervals = events.filter(e=> dayjs(e.start_time).isAfter(dayStart.subtract(1,'minute')) && dayjs(e.start_time).isBefore(dayEnd))
    .map(e=>({ start: dayjs(e.start_time), end: dayjs(e.end_time) }));
  const scheduled = [];
  let cursor = dayStart.clone();
  for (const c of candidates) {
    // find next free 1h slot
    let placed = false;
    while (cursor.add(1,'minute').isBefore(dayEnd)) {
      const slotStart = cursor.clone();
      const slotEnd = slotStart.add(1,'hour');
      if (slotEnd.isAfter(dayEnd)) break;
      const conflict = intervals.some(iv => iv.start.isBefore(slotEnd) && iv.end.isAfter(slotStart));
      if (!conflict) {
        try {
          const ev = await scheduleEvent({ title: c.title + ' (block)', datetime_start: slotStart.toISOString(), datetime_end: slotEnd.toISOString() });
          intervals.push({ start: slotStart, end: slotEnd });
          scheduled.push(ev);
        } catch(e){ /* ignore */ }
        placed = true; cursor = slotEnd.add(5,'minute'); break;
      } else {
        // jump to end of earliest overlapping interval
        const overlapping = intervals.filter(iv => iv.start.isBefore(slotEnd) && iv.end.isAfter(slotStart)).sort((a,b)=> a.end.valueOf()-b.end.valueOf());
        if (overlapping[0]) cursor = overlapping[0].end.add(5,'minute'); else cursor = cursor.add(5,'minute');
      }
    }
    if (!placed) break; // no more space
  }
  if (scheduled.length) await remember({ role:'action', action:{ action:'auto_schedule_top_tasks' }, result:{ count: scheduled.length }});
  return { scheduled };
}
export async function fn_send_telegram({ message }) {
  await sendTelegram(message);
  return { ok: true };
}
export async function fn_generate_daily_summary({ date }) {
  return await generateDailySummary(date || dayjs().format('YYYY-MM-DD'));
}
export async function fn_evaluate_day({ date }) {
  return await evaluateDay(date || dayjs().format('YYYY-MM-DD'));
}

export async function fn_list_tasks() {
  return await listAllTasks();
}
export async function fn_list_events() {
  return await listAllEvents();
}
export async function fn_list_goals() { return await listGoals(); }
export async function fn_add_goal({ title, target_date }) { return await addGoal({ title, target_date }); }
export async function fn_update_goal_progress({ goal_id, progress }) { return await updateGoalProgress({ goal_id, progress }); }
export async function fn_update_goal({ goal_id, title, target_date }) { return await updateGoal({ goal_id, title, target_date }); }
export async function fn_delete_goal({ goal_id }) { return await deleteGoal(goal_id); }
export async function fn_update_event({ event_id, title, start_time, end_time }) { return await updateEvent({ event_id, title, start_time, end_time }); }
export async function fn_delete_event({ event_id }) { return await deleteEvent(event_id); }

export async function fn_generate_subtasks({ parent_title, count=3 }) {
  // naive segmentation by heuristics
  const fragments = heuristicBreakdown(parent_title, count);
  const parent = await addTask({ title: parent_title });
  const created = [];
  for (const f of fragments) {
    const st = await addSubTask({ parent_task_id: parent.id, title: f });
    created.push(st);
  }
  return { parent, subtasks: created };
}

// --- Agentic enhancement: prioritize tasks ---
export async function fn_prioritize_tasks() {
  const tasks = await listAllTasks();
  const now = dayjs();
  const scored = tasks.map(t => {
    const priorityWeight = ({ urgent: 4, important: 3, normal: 2, low: 1 })[t.priority] || 2;
    let deadlineWeight = 0;
    if (t.deadline) {
      const diffH = dayjs(t.deadline).diff(now, 'hour');
      if (diffH <= 0) deadlineWeight = 5; // overdue
      else if (diffH <= 6) deadlineWeight = 4;
      else if (diffH <= 24) deadlineWeight = 3;
      else if (diffH <= 72) deadlineWeight = 2;
      else deadlineWeight = 1;
    }
    const createdAt = t.created_at ? dayjs(t.created_at) : now;
    const ageHours = Math.max(0, now.diff(createdAt,'hour'));
    // Age decay: older tasks lose up to 2 points over 7 days
    const agePenalty = Math.min(2, (ageHours / (24*7)) * 2); // linear up to 2
    const depthPenalty = t.parent_task_id ? 0.2 : 0; // parent higher
    const statusPenalty = t.status === 'done' ? -10 : 0;
    const score = priorityWeight + deadlineWeight - depthPenalty + statusPenalty - agePenalty;
    let reasons = [];
    reasons.push(`priority:${t.priority}`);
    if (t.deadline) reasons.push(`deadline ${t.deadline ? dayjs(t.deadline).fromNow() : ''}`);
    if (agePenalty>0) reasons.push(`age decay -${agePenalty.toFixed(2)}`);
    if (t.status === 'done') reasons.push('already done');
    if (t.parent_task_id) reasons.push('subtask');
    return { ...t, _score: Number(score.toFixed(2)), _reasons: reasons, _age_hours: ageHours };
  });
  scored.sort((a,b)=> b._score - a._score);
  return scored;
}

export async function fn_suggest_next_task() {
  const prioritized = await fn_prioritize_tasks();
  const next = prioritized.find(t => t.status !== 'done');
  if (!next) return { message: 'Tidak ada task aktif.' };
  return { suggestion: next, rationale: next._reasons };
}

export async function fn_focus_today() {
  const prioritized = await fn_prioritize_tasks();
  const top = prioritized.filter(t=> t.status !== 'done').slice(0,3);
  const next = top[0];
  await remember({ role:'system', content:'focus_today computed', result:{ next: next?.id, top: top.map(t=>t.id) } });
  return { next, top, count: prioritized.length };
}

export async function fn_memory_summary() {
  const mem = await recentMemory(50);
  const actionCounts = {};
  const userTexts = [];
  const addedTasks = [];
  for (const m of mem) {
    if (m.role === 'user' && m.content) userTexts.push(m.content);
    if (m.role === 'action' && m.action?.action) {
      actionCounts[m.action.action] = (actionCounts[m.action.action]||0)+1;
      if (m.action.action === 'add_task' && m.result?.title) addedTasks.push({ title:m.result.title, id:m.result.id });
    }
  }
  const summary = {
    actions: actionCounts,
    recent_user_queries: userTexts.slice(-5),
    recent_added_tasks: addedTasks.slice(-5)
  };
  await remember({ role:'system', content:'memory_summary', result: summary });
  return summary;
}

export async function fn_detect_stagnant_tasks({ hours=48 }) {
  const tasks = await listAllTasks();
  const now = dayjs();
  const stale = tasks.filter(t=> t.status !== 'done' && t.created_at && now.diff(dayjs(t.created_at),'hour') >= hours);
  const suggestions = stale.map(t=> ({ id:t.id, title:t.title, suggestion:'Pertimbangkan pecah menjadi sub-task atau jadwalkan blok fokus.' }));
  await remember({ role:'system', content:'stagnant_scan', result:{ count: stale.length }});
  return { count: stale.length, tasks: suggestions };
}

export async function fn_progress_overview() {
  const all = await listAllTasks();
  const done = await listDoneTasks();
  const ratio = all.length ? (done.length / all.length) : 0;
  return { total: all.length, done: done.length, completion_ratio: Number(ratio.toFixed(2)) };
}

export async function fn_trend_overview({ days=7 }) {
  const evals = await listDailyEvaluations(days);
  const reflections = await listReflections(days);
  // Normalize structure
  const evalSeries = evals.map(e=>({ date: e.date, ratio: e.content?.completed_ratio ?? e.content?.completed_ratio_numeric ?? 0 }));
  const avg = evalSeries.length? evalSeries.reduce((a,b)=> a+b.ratio,0)/evalSeries.length:0;
  const last = evalSeries[0]?.ratio || 0;
  const delta = evalSeries.length>1? last - evalSeries[evalSeries.length-1].ratio : 0;
  return { series: evalSeries.reverse(), avg: Number(avg.toFixed(2)), last: Number(last.toFixed(2)), delta: Number(delta.toFixed(2)), reflections: reflections.map(r=>({ date:r.date, improvements: r.content?.improvements||[], issues:r.content?.issues||[] })) };
}

// === OLLAMA-POWERED VALUE-ADD FUNCTIONS ===
// 1. Rewrite / refine task title
export async function fn_refine_task_title({ raw_title, style='singkat' }) {
  if (!raw_title) throw new Error('raw_title wajib');
  const prompt = `Perbaiki / refinasi judul tugas berikut agar ${style} dan action oriented. Beri hanya judul baru tanpa penjelasan tambahan.\nJudul: ${raw_title}`;
  const out = await callLLM(prompt, { temperature:0.4 });
  return { original: raw_title, refined: out || raw_title };
}
// 2. Generate micro brief for a task (why, outcome, 3 langkah)
export async function fn_task_brief({ title }) {
  if (!title) throw new Error('title wajib');
  const prompt = `Buat ringkas micro brief (JSON) untuk task: ${title}\nFormat: {"why":"...","outcome":"...","steps":["...","...","..."]}`;
  const raw = await callLLM(prompt, { temperature:0.3 });
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
  return { title, brief: parsed };
}
// 3. Explain priority rationale for current tasks (top 5) using existing scoring
export async function fn_explain_priorities() {
  const scored = await fn_prioritize_tasks();
  const top = scored.filter(t=> t.status!=='done').slice(0,5);
  const lines = top.map(t=> `- ${t.title} | score ${t._score} | reasons: ${t._reasons.join(', ')}`).join('\n');
  const prompt = `Jelaskan secara sangat ringkas (maks 60 kata) kenapa 5 task berikut berada di urutan teratas dan beri 1 saran fokus pertama.\n${lines}`;
  const explanation = await callLLM(prompt, { temperature:0.2 });
  return { tasks: top.map(t=>({ id:t.id, title:t.title, score:t._score })), explanation };
}
// 4. Quick day timeline suggestion based on tasks & events
export async function fn_plan_day() {
  const tasks = await listAllTasks();
  const events = await listAllEvents();
  const open = tasks.filter(t=> t.status!=='done').slice(0,8);
  const taskLines = open.map(t=> `- ${t.title}${t.deadline? ' (deadline '+t.deadline+')':''}`).join('\n');
  const eventLines = events.slice(0,6).map(e=> `- ${e.title} ${e.start_time} - ${e.end_time}`).join('\n');
  const prompt = `KELUARKAN JSON MURNI SAJA tanpa penjelasan, tanpa backticks. Bentuk: {"blocks":[{"time":"HH:MM","focus":"..."}, ...]}. Periode 08:00-18:00. Pastikan urut naik & tidak konflik event. Jika kurang slot, isi yang penting saja.\nTasks:\n${taskLines}\nEvents:\n${eventLines}\nJSON:`;
  const raw = await callLLM(prompt, { temperature:0 });
  function extractJSON(txt){
    if(!txt) return null;
    const cleaned = txt.replace(/```[a-zA-Z]*|```/g,'').trim();
    // find first '{' and last '}'
    const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
    if (s!==-1 && e!==-1 && e>s){
      const slice = cleaned.slice(s,e+1);
      try { return JSON.parse(slice); } catch{/* ignore */}
    }
    try { return JSON.parse(cleaned); } catch { return null; }
  }
  let parsed = extractJSON(raw) || { raw };
  // Build natural summary
  let summary = '';
  if (parsed.blocks && Array.isArray(parsed.blocks)){
    summary = parsed.blocks.map(b=> `${b.time} — ${b.focus}`).join('\n');
  } else if (parsed.raw){
    summary = parsed.raw.split(/\n+/).slice(0,6).join('\n');
  }
  return { plan: parsed, summary };
}

// 5. Generate & store explanation for a task
export async function fn_generate_task_explanation({ task_id }) {
  if (!task_id) throw new Error('task_id wajib');
  const tasks = await listAllTasks();
  const t = tasks.find(x=> x.id === task_id);
  if (!t) throw new Error('Task tidak ditemukan');
  const context = tasks.filter(x=> x.id!==task_id && !x.parent_task_id).slice(0,5).map(x=> `- ${x.title}${x.deadline? ' (deadline '+x.deadline+')':''}`).join('\n');
  const prompt = `Task: ${t.title}\nDeadline: ${t.deadline || '-'}\nKonteks tugas lain:\n${context}\nJelaskan secara singkat (<=40 kata) mengapa task ini penting dan apa kriteria selesai yang jelas.`;
  const explanation = await callLLM(prompt, { temperature:0.3 });
  const updated = await updateTask({ task_id, ai_explanation: explanation });
  return { task_id, ai_explanation: explanation, updated_at: updated.updated_at };
}


// Refine a single event title if it's generic
export async function fn_refine_event_title({ event_id }) {
  if (!event_id) throw new Error('event_id wajib');
  const events = await listAllEvents();
  const ev = events.find(e=> e.id === event_id);
  if (!ev) throw new Error('Event tidak ditemukan');
  const generic = !ev.title || /^event$/i.test(ev.title.trim()) || ev.title.trim().length < 4;
  const tasks = await listAllTasks();
  // Build context: top 5 open tasks
  const openTop = tasks.filter(t=> t.status!=='done').slice(0,5).map(t=> `- ${t.title}${t.deadline? ' (deadline '+t.deadline+')':''}`).join('\n');
  const prompt = `Berikan judul ringkas (<=4 kata) dan jelas untuk blok waktu berikut. Jika tidak ada konteks jelas gunakan Blok Fokus. Hanya keluarkan judul final tanpa tanda kutip.
Waktu: ${ev.start_time} - ${ev.end_time}
Judul sekarang: ${ev.title || '-'}
Daftar tugas relevan:\n${openTop}`;
  if (!generic) return { event_id, skipped:true, reason:'sudah spesifik' };
  const refined = await callLLM(prompt, { temperature:0.4 });
  const clean = (refined || '').split(/\n+/)[0].trim().replace(/^"|"$/g,'');
  if (!clean) return { event_id, skipped:true };
  if (clean.toLowerCase()==='event') return { event_id, skipped:true };
  const updated = await updateEvent({ event_id, title: clean });
  return { event_id, old_title: ev.title, new_title: updated.title };
}

function heuristicBreakdown(title, count){
  const baseWords = title.split(/\s+/).filter(Boolean);
  if (baseWords.length < 4){
    return Array.from({length:count}, (_,i)=> `${title} - langkah ${i+1}`);
  }
  const size = Math.ceil(baseWords.length / count);
  const chunks = [];
  for (let i=0;i<baseWords.length;i+=size){
    chunks.push(baseWords.slice(i,i+size).join(' '));
  }
  while (chunks.length < count) chunks.push(`${title} - ekstra ${chunks.length+1}`);
  return chunks.slice(0,count).map((c,i)=>`#${i+1} ${c}`);
}

export const exposedFunctions = {
  add_task: fn_add_task,
  update_task_status: fn_update_task_status,
  update_task: fn_update_task,
  delete_task: fn_delete_task,
  schedule_event: fn_schedule_event,
  schedule_recurring_event: fn_schedule_recurring_event,
  shift_next_event: fn_shift_next_event,
  send_telegram: fn_send_telegram,
  generate_daily_summary: fn_generate_daily_summary,
  evaluate_day: fn_evaluate_day,
  list_tasks: fn_list_tasks,
  list_events: fn_list_events
  ,list_goals: fn_list_goals
  ,add_goal: fn_add_goal
  ,update_goal_progress: fn_update_goal_progress
  ,update_goal: fn_update_goal
  ,delete_goal: fn_delete_goal
  ,update_event: fn_update_event
  ,delete_event: fn_delete_event
  ,generate_subtasks: fn_generate_subtasks
  ,prioritize_tasks: fn_prioritize_tasks
  ,suggest_next_task: fn_suggest_next_task
  ,focus_today: fn_focus_today
  ,memory_summary: fn_memory_summary
  ,auto_schedule_top_tasks: fn_auto_schedule_top_tasks
  ,detect_stagnant_tasks: fn_detect_stagnant_tasks
  ,progress_overview: fn_progress_overview
  ,trend_overview: fn_trend_overview
  ,reset_all_tasks: async ()=> await deleteAllTasks()
  ,reset_all_events: async ()=> await deleteAllEvents()
  ,reset_all_goals: async ()=> await deleteAllGoals()
  ,refine_task_title: fn_refine_task_title
  ,task_brief: fn_task_brief
  ,explain_priorities: fn_explain_priorities
  ,plan_day: fn_plan_day
  ,generate_task_explanation: fn_generate_task_explanation
  ,refine_event_title: fn_refine_event_title
};