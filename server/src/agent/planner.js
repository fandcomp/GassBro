import dayjs from 'dayjs';
import { startOfDay, endOfDay } from '../utils/time.js';
import { listOpenTasks, listEventsForDate, insertDailySummary, insertDailyEvaluation, listAllTasks } from '../services/supabase.js';
import { buildDaySlots, allocateTasksToSlots } from '../utils/scheduling.js';

export async function generateDailySummary(dateStr) {
  const date = dayjs(dateStr).format('YYYY-MM-DD');
  const tasks = await listOpenTasks();
  tasks.sort((a,b)=>{
    const prioRank = p => ({ urgent:0, important:1, optional:2 })[p] ?? 1;
    const dA = a.deadline ? dayjs(a.deadline).valueOf(): Infinity;
    const dB = b.deadline ? dayjs(b.deadline).valueOf(): Infinity;
    return prioRank(a.priority)-prioRank(b.priority) || dA-dB;
  });
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const events = await listEventsForDate(dayStart.toISOString(), dayEnd.toISOString());
  const slots = buildDaySlots(date, events);
  const { plan, unscheduled } = allocateTasksToSlots(tasks, slots);

  const focusBlock = plan[0] ? `${plan[0].start.format('HH:mm')}–${plan[0].end.format('HH:mm')}` : '09:00–11:00';
  // Build simple reschedule suggestions for unscheduled tasks (next free day slot tomorrow)
  const suggestions = unscheduled.map(u=>{
    return { task_id: u.id, suggestion: 'Pertimbangkan jadwalkan besok pagi 09:00' };
  });

  const summary = {
    date,
    tasks_count: tasks.length,
    events_count: events.length,
    first_deadline: tasks.filter(t=>t.deadline).sort((a,b)=>dayjs(a.deadline)-dayjs(b.deadline))[0]?.deadline || null,
    focus_recommendation: focusBlock,
    plan: plan.map(p => ({ id: p.task.id, title: p.task.title, start: p.start.toISOString(), end: p.end.toISOString() })),
    unscheduled: unscheduled.map(u => ({ id: u.id, title: u.title })),
    reschedule_suggestions: suggestions
  };
  await insertDailySummary(date, summary);
  return summary;
}

export async function evaluateDay(dateStr) {
  const date = dayjs(dateStr).format('YYYY-MM-DD');
  const allTasks = await listAllTasks();
  const done = allTasks.filter(t=> t.status==='done');
  const active = allTasks.filter(t=> t.status!=='done');
  const ratio = allTasks.length ? (done.length / allTasks.length) : 0;
  // simple recommendation heuristic
  let recommendations = 'Pertahankan konsistensi.';
  if (ratio < 0.3) recommendations = 'Besok fokus selesaikan 1-2 tugas prioritas sejak pagi.';
  else if (ratio < 0.6) recommendations = 'Dorong penyelesaian task menengah sebelum jam makan siang.';
  else if (ratio >= 0.9) recommendations = 'Hebat! Mulai tangani backlog atau peningkatan kualitas.';
  const evalObj = {
    date,
    completed_ratio: ratio,
    total: allTasks.length,
    done: done.length,
    remaining: active.length,
    notes: 'Auto-eval berdasarkan status task.',
    recommendations
  };
  await insertDailyEvaluation(date, evalObj);
  return evalObj;
}
