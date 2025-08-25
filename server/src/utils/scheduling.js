import dayjs from 'dayjs';
import { CONFIG } from '../env.js';

export function buildDaySlots(date, events = []) {
  const [hStart, mStart] = CONFIG.workHoursStart.split(':').map(Number);
  const [hEnd, mEnd] = CONFIG.workHoursEnd.split(':').map(Number);
  const start = dayjs(date).hour(hStart).minute(mStart).second(0);
  const end = dayjs(date).hour(hEnd).minute(mEnd).second(0);

  const busy = events.map(e => ({ start: dayjs(e.start_time), end: dayjs(e.end_time), type: 'event', ref: e }));
  busy.sort((a,b)=>a.start - b.start);

  const free = [];
  let cursor = start;
  for (const b of busy) {
    if (b.start.isAfter(cursor)) {
      free.push({ start: cursor, end: b.start });
    }
    if (b.end.isAfter(cursor)) cursor = b.end;
  }
  if (cursor.isBefore(end)) free.push({ start: cursor, end });
  return { free, busy, workStart: start, workEnd: end };
}

export function allocateTasksToSlots(tasks, slots) {
  const plan = [];
  const remaining = [...tasks];
  for (const slot of slots.free) {
    let slotCursor = slot.start;
    while (remaining.length) {
      const t = remaining[0];
      const est = t.estimated_minutes || 30;
      const slotEnd = slot.end;
      if (slotCursor.add(est, 'minute').isAfter(slotEnd)) break;
      plan.push({ task: t, start: slotCursor, end: slotCursor.add(est,'minute') });
      slotCursor = slotCursor.add(est,'minute');
      remaining.shift();
    }
  }
  return { plan, unscheduled: remaining };
}
