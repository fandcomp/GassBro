import dayjs from 'dayjs';
import { listCallable } from './functionRegistry.js';

// Very naive rule-based intent parser
export function interpret(text){
  const lower = text.toLowerCase().trim();
  // Multi-step split by ' dan ' or ' lalu '
  const segments = lower.split(/\b(?:dan|lalu|kemudian)\b/).map(s=>s.trim()).filter(Boolean);
  const intents = segments.map(seg=> parseSingle(seg));
  return intents;
}

function parseSingle(seg){
  // add task
  if (/^t(ambahkan|ambah)? task /.test(seg) || seg.startsWith('task ')){
    const title = seg.replace(/^t(ambahkan|ambah)? task /,'').replace(/^task /,'').trim();
    return { action:'add_task', params:{ title } };
  }
  if (/^summary/.test(seg) || /ringkasan/.test(seg)){
    return { action:'generate_daily_summary', params:{} };
  }
  if (/evaluasi/.test(seg)){
    return { action:'evaluate_day', params:{} };
  }
  if (/jadwalkan|schedule/.test(seg)){
    // Extract hours like 09:00 or 9.00 and duration like 2 jam
    const titleMatch = seg.match(/(?:jadwalkan|schedule) (.+?)(?: pada| jam| pukul|$)/);
    const title = titleMatch? titleMatch[1] : 'Event';
    const timeMatch = seg.match(/(\d{1,2}[:.,]\d{2})/);
    const startBase = dayjs();
    let start = startBase.startOf('hour');
    if (timeMatch){
      const parts = timeMatch[1].replace(',',':').replace('.',':').split(':');
      start = startBase.hour(parseInt(parts[0],10)).minute(parseInt(parts[1],10)||0);
    }
    const durMatch = seg.match(/(\d+) *jam/);
    const hours = durMatch? parseInt(durMatch[1],10) : 1;
    const end = start.add(hours,'hour');
    return { action:'schedule_event', params:{ title, datetime_start: start.toISOString(), datetime_end: end.toISOString() } };
  }
  if (/pecah|breakdown|subtask/.test(seg)){
    // e.g. "pecah task riset model baru jadi 4 subtask"
    const countMatch = seg.match(/(\d+) *sub/);
    const count = countMatch? parseInt(countMatch[1],10):3;
    const titleMatch = seg.match(/(?:pecah|breakdown|subtask) (?:task )?(.+?)(?: jadi| ke | menjadi|$)/);
    const parent_title = titleMatch? titleMatch[1].trim(): seg.replace(/pecah|breakdown|subtask/g,'').trim();
    return { action:'generate_subtasks', params:{ parent_title, count } };
  }
  if (/prioritas|priorit(a|i)se?|urutkan task/.test(seg)) {
    return { action:'prioritize_tasks', params:{} };
  }
  if (/task berikut|apa selanjutnya|next task|saran task/.test(seg)){
    return { action:'suggest_next_task', params:{} };
  }
  if (/fokus hari ini|focus today|apa fokus|task fokus/.test(seg)) {
    return { action:'focus_today', params:{} };
  }
  if (/ringkas memory|summary memory|rekap memory/.test(seg)) {
    return { action:'memory_summary', params:{} };
  }
  // fallback echo
  return { action:'echo', params:{ text: seg } };
}

export function listCapabilities(){
  return listCallable().map(f=> ({ name:f.name, description:f.description }));
}
