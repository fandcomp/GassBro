import dayjs from 'dayjs';

const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','jum\u2019at','sabtu'];

function mapDayName(word){
  const idx = dayNames.indexOf(word);
  if(idx===-1) return null; return idx; // 0 = minggu ... 6 = sabtu
}

export function parseIndoDateTime(text){
  const lower = text.toLowerCase();
  let base = dayjs();
  let tzAdjHours = 0; // relative adjustment from default (assumed WIB)
  if (/\bwita\b/.test(lower)) tzAdjHours = 1; else if (/\bw i t a\b/.test(lower)) tzAdjHours = 1; // robustness
  if (/\bw i t\b/.test(lower) || /\bw i t\b/.test(lower)) tzAdjHours = 2; // WIT
  if (/\bwib\b/.test(lower)) tzAdjHours = 0;
  // besok / lusa
  if (/\bbesok\b/.test(lower)) base = base.add(1,'day');
  if (/\blusa\b/.test(lower)) base = base.add(2,'day');
  // specific day name (next occurrence)
  for (const dn of dayNames){
    if (lower.includes(dn)){
      const targetDow = mapDayName(dn);
      for (let i=0;i<7;i++){ if (base.day()===targetDow) break; base = base.add(1,'day'); }
      break;
    }
  }
  // time extraction / range detection
  // Patterns for explicit range: 09:00-10:30, 9-10, 09.00 sampai 10.30
  let startHour=null, startMinute=0, endHour=null, endMinute=0;
  const rangeRegexes = [
    /(\d{1,2})[:.](\d{2})\s*(?:-|sampai|s\/d|to)\s*(\d{1,2})[:.](\d{2})/,
    /(\d{1,2})\s*(?:-|sampai|s\/d|to)\s*(\d{1,2})/,
  ];
  for (const rg of rangeRegexes){
    const m = lower.match(rg);
    if (m){
      if (m.length === 5) { // HH:MM - HH:MM
        startHour = parseInt(m[1],10); startMinute = parseInt(m[2],10);
        endHour = parseInt(m[3],10); endMinute = parseInt(m[4],10);
      } else if (m.length === 3) { // H - H
        startHour = parseInt(m[1],10); startMinute = 0;
        endHour = parseInt(m[2],10); endMinute = 0;
      }
      break;
    }
  }
  let explicitRange = startHour!==null && endHour!==null;
  if (!explicitRange){
    // single time
    let hour=null, minute=0;
    const timeMatch = lower.match(/\b(\d{1,2})(?:[:.](\d{2}))?\b *(?:wib|wit|wita)?/);
    if (timeMatch){
      hour = parseInt(timeMatch[1],10); minute = timeMatch[2]? parseInt(timeMatch[2],10):0;
    } else {
      if (/pagi/.test(lower)) hour = 8;
      else if (/siang/.test(lower)) hour = 13;
      else if (/sore/.test(lower)) hour = 16;
      else if (/malam/.test(lower)) hour = 19;
    }
    if (hour!==null && hour>23) hour = hour % 24;
    startHour = hour; startMinute = minute;
  }
  let start = base;
  if (startHour!==null) start = start.hour(startHour).minute(startMinute).second(0).millisecond(0);
  else start = start.hour(9).minute(0).second(0);
  let end;
  if (explicitRange){
    if (endHour>23) endHour = endHour % 24;
    end = base.hour(endHour).minute(endMinute).second(0).millisecond(0);
    if (end.isBefore(start) || end.isSame(start)) end = end.add(1,'hour');
  } else {
    // duration
    let durationMin = 30; // default 30 menit
    const jamMatch = lower.match(/(\d+) *jam/);
    if (jamMatch){ durationMin = parseInt(jamMatch[1],10)*60; }
    const menitMatch = lower.match(/(\d+) *menit/);
    if (menitMatch){
      // if duration already hours specified, add; else if only menit override
      if (jamMatch) durationMin += parseInt(menitMatch[1],10); else durationMin = parseInt(menitMatch[1],10);
    }
    end = start.add(durationMin,'minute');
  }
  const adjStart = tzAdjHours ? start.add(tzAdjHours,'hour') : start;
  const adjEnd = tzAdjHours ? end.add(tzAdjHours,'hour') : end;
  return { start: adjStart.toISOString(), end: adjEnd.toISOString(), inferred:!explicitRange, tz_offset_applied: tzAdjHours };
}

export function classifyIntentHeuristic(text){
  const lower = text.toLowerCase();
  if (/jadwal|schedule|ketemu|meeting|rapat|janji|voli|bola|kelas/.test(lower)){
    return 'schedule_event';
  }
  if (/task|kerjakan|buat|tugas|selesaikan/.test(lower)) return 'add_task';
  return null;
}
