import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../env.js';

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseService);

export async function addTask({ title, deadline, priority='important' }) {
  const { data, error } = await supabase.from('tasks').insert({ title, deadline, priority }).select().single();
  if (error) { console.error('[supabase:addTask]', error); throw error; }
  return data;
}

export async function addSubTask({ parent_task_id, title, deadline, priority='normal' }) {
  const { data, error } = await supabase.from('tasks').insert({ title, deadline, priority, parent_task_id }).select().single();
  if (error) { console.error('[supabase:addSubTask]', error); throw error; }
  return data;
}

export async function updateTaskStatus(task_id, status) {
  const { data, error } = await supabase.from('tasks').update({ status }).eq('id', task_id).select().single();
  if (error) { console.error('[supabase:updateTaskStatus]', error); throw error; }
  return data;
}

export async function updateTask({ task_id, title, deadline, priority, ai_explanation }) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (deadline !== undefined) payload.deadline = deadline;
  if (priority !== undefined) payload.priority = priority;
  if (ai_explanation !== undefined) payload.ai_explanation = ai_explanation;
  if (Object.keys(payload).length === 0) throw new Error('No fields to update');
  let { data, error } = await supabase.from('tasks').update(payload).eq('id', task_id).select().single();
  if (error && error.message && /ai_explanation/.test(error.message)) {
    // Retry without ai_explanation if column missing
    console.warn('[supabase:updateTask] retry without ai_explanation column');
    delete payload.ai_explanation;
    ({ data, error } = await supabase.from('tasks').update(payload).eq('id', task_id).select().single());
  }
  if (error) { console.error('[supabase:updateTask]', error); throw error; }
  return data;
}

export async function deleteTask(task_id) {
  const { data, error } = await supabase.from('tasks').delete().eq('id', task_id).select();
  if (error) { console.error('[supabase:deleteTask]', error); throw error; }
  if (!data || data.length === 0) { throw new Error('Task tidak ditemukan'); }
  return { ok: true, deleted: data.map(d=>d.id) };
}

// Bulk deletes (dangerous): ensure caller confirms
export async function deleteAllTasks() {
  const { data: rows, error: selErr } = await supabase.from('tasks').select('id');
  if (selErr) { console.error('[supabase:deleteAllTasks:select]', selErr); throw selErr; }
  if (!rows || rows.length===0) return { ok:true, count:0 };
  const ids = rows.map(r=>r.id);
  const { error: delErr } = await supabase.from('tasks').delete().in('id', ids);
  if (delErr) { console.error('[supabase:deleteAllTasks:delete]', delErr); throw delErr; }
  return { ok:true, count: ids.length };
}

export async function scheduleEvent({ title, datetime_start, datetime_end }) {
  const { data, error } = await supabase.from('events').insert({ title, start_time: datetime_start, end_time: datetime_end }).select().single();
  if (error) { console.error('[supabase:scheduleEvent]', error); throw error; }
  return data;
}

export async function listOpenTasks() {
  const { data, error } = await supabase.from('tasks').select('*').in('status', ['pending','in_progress']).order('deadline',{ ascending: true });
  if (error) { console.error('[supabase:listOpenTasks]', error); throw error; }
  return data;
}

export async function listAllTasks() {
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) { console.error('[supabase:listAllTasks]', error); throw error; }
  return data;
}

export async function listDoneTasks() {
  const { data, error } = await supabase.from('tasks').select('*').eq('status','done');
  if (error) { console.error('[supabase:listDoneTasks]', error); throw error; }
  return data;
}

export async function insertDailySummary(date, content) {
  const { data, error } = await supabase.from('daily_summaries').upsert({ date, content }, { onConflict: 'date' }).select().single();
  if (error) { console.error('[supabase:insertDailySummary]', error); throw error; }
  return data;
}

export async function insertDailyEvaluation(date, content) {
  const { data, error } = await supabase.from('daily_evaluations').upsert({ date, content }, { onConflict: 'date' }).select().single();
  if (error) { console.error('[supabase:insertDailyEvaluation]', error); throw error; }
  return data;
}

export async function listDailyEvaluations(limit=7){
  const { data, error } = await supabase.from('daily_evaluations').select('*').order('date',{ ascending:false }).limit(limit);
  if (error){ console.error('[supabase:listDailyEvaluations]', error); throw error; }
  return data;
}

export async function listEventsForDate(dateStart, dateEnd) {
  const { data, error } = await supabase.from('events')
    .select('*')
    .gte('start_time', dateStart)
    .lte('end_time', dateEnd)
    .order('start_time', { ascending: true });
  if (error) { console.error('[supabase:listEventsForDate]', error); throw error; }
  return data;
}

export async function listAllEvents() {
  const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
  if (error) { console.error('[supabase:listAllEvents]', error); throw error; }
  return data;
}

// Reflections (may require table agent_reflections(date primary, content jsonb))
export async function insertReflection(date, content){
  try {
    const { data, error } = await supabase.from('agent_reflections').upsert({ date, content }, { onConflict:'date' }).select().single();
    if (error) { console.warn('[supabase:insertReflection]', error.message); return { warning: error.message }; }
    return data;
  } catch(e){ console.warn('[supabase:insertReflection catch]', e.message); return { warning: e.message }; }
}

export async function listReflections(limit=7){
  try {
    const { data, error } = await supabase.from('agent_reflections').select('*').order('date',{ ascending:false }).limit(limit);
    if (error){ console.warn('[supabase:listReflections]', error.message); throw error; }
    return data;
  } catch(e){ console.warn('[supabase:listReflections catch]', e.message); return []; }
}

// Goals
export async function listGoals() {
  const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
  if (error) { console.error('[supabase:listGoals]', error); throw error; } return data;
}
export async function addGoal({ title, target_date }) {
  const { data, error } = await supabase.from('goals').insert({ title, target_date }).select().single();
  if (error) { console.error('[supabase:addGoal]', error); throw error; } return data;
}
export async function updateGoalProgress({ goal_id, progress }) {
  const { data, error } = await supabase.from('goals').update({ progress }).eq('id', goal_id).select();
  if (error) { console.error('[supabase:updateGoalProgress]', error); throw error; }
  if (!data || data.length === 0) { throw new Error('Goal tidak ditemukan'); }
  return data[0];
}

export async function updateGoal({ goal_id, title, target_date }) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (target_date !== undefined) payload.target_date = target_date;
  if (Object.keys(payload).length === 0) throw new Error('No fields to update');
  const { data, error } = await supabase.from('goals').update(payload).eq('id', goal_id).select().single();
  if (error) { console.error('[supabase:updateGoal]', error); throw error; } return data;
}
export async function deleteGoal(goal_id) {
  const { data, error } = await supabase.from('goals').delete().eq('id', goal_id).select();
  if (error) { console.error('[supabase:deleteGoal]', error); throw error; } 
  if (!data || data.length === 0) throw new Error('Goal tidak ditemukan');
  return { ok:true, deleted: data.map(d=>d.id) };
}

export async function updateEvent({ event_id, title, start_time, end_time }) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (start_time !== undefined) payload.start_time = start_time;
  if (end_time !== undefined) payload.end_time = end_time;
  if (Object.keys(payload).length === 0) throw new Error('No fields to update');
  const { data, error } = await supabase.from('events').update(payload).eq('id', event_id).select().single();
  if (error) { console.error('[supabase:updateEvent]', error); throw error; } return data;
}
export async function deleteEvent(event_id) {
  const { data, error } = await supabase.from('events').delete().eq('id', event_id).select();
  if (error) { console.error('[supabase:deleteEvent]', error); throw error; } 
  if (!data || data.length === 0) throw new Error('Event tidak ditemukan');
  return { ok:true, deleted: data.map(d=>d.id) };
}

export async function deleteAllEvents() {
  const { data: rows, error: selErr } = await supabase.from('events').select('id');
  if (selErr) { console.error('[supabase:deleteAllEvents:select]', selErr); throw selErr; }
  if (!rows || rows.length===0) return { ok:true, count:0 };
  const ids = rows.map(r=>r.id);
  const { error: delErr } = await supabase.from('events').delete().in('id', ids);
  if (delErr) { console.error('[supabase:deleteAllEvents:delete]', delErr); throw delErr; }
  return { ok:true, count: ids.length };
}

export async function deleteAllGoals() {
  const { data: rows, error: selErr } = await supabase.from('goals').select('id');
  if (selErr) { console.error('[supabase:deleteAllGoals:select]', selErr); throw selErr; }
  if (!rows || rows.length===0) return { ok:true, count:0 };
  const ids = rows.map(r=>r.id);
  const { error: delErr } = await supabase.from('goals').delete().in('id', ids);
  if (delErr) { console.error('[supabase:deleteAllGoals:delete]', delErr); throw delErr; }
  return { ok:true, count: ids.length };
}
