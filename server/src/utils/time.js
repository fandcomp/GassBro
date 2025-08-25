import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { CONFIG } from '../env.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

// Set default timezone if provided
const TZ = CONFIG.timezone || 'Asia/Jakarta';
try { dayjs.tz.setDefault(TZ); } catch(e){ /* ignore invalid tz */ }

export function now(){
  return dayjs.tz ? dayjs.tz() : dayjs();
}

export function toTz(date){
  return dayjs.tz ? dayjs.tz(date) : dayjs(date);
}

export function startOfDay(date){
  return toTz(date).startOf('day');
}

export function endOfDay(date){
  return toTz(date).endOf('day');
}

export function formatDisplay(date){
  return toTz(date).format('YYYY-MM-DD HH:mm');
}

export function getTimezone(){
  return TZ;
}

export function normalizeEventTimes(startIso, endIso){
  const s = toTz(startIso);
  const e = toTz(endIso);
  return { start: s.toISOString(), end: e.toISOString() };
}

export function describeNow(){
  const n = now();
  return {
    timezone: getTimezone(),
    local_iso: n.format(),
    utc_iso: n.utc().format(),
    epoch_ms: n.valueOf()
  };
}

export default dayjs;