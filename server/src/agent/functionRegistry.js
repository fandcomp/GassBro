// Simple function registry with metadata for agent reasoning
import { exposedFunctions } from '../services/agentFunctions.js';

export const functionRegistry = [
  {
    name: 'add_task',
    description: 'Tambahkan task baru',
    params: { title:'string', deadline:'string? (ISO)', priority:'string? (urgent|important|normal|low)' }
  },
  {
    name: 'update_task_status',
    description: 'Ubah status task',
    params: { task_id:'uuid/int', status:'pending|in_progress|done|blocked' }
  },
  { name: 'schedule_event', description:'Jadwalkan event', params:{ title:'string', datetime_start:'ISO', datetime_end:'ISO' }},
  { name: 'schedule_recurring_event', description:'Buat event mingguan berulang', params:{ day_of_week:'0-6', start_time_hhmm:'HH:MM', end_time_hhmm:'HH:MM', weeks:'int? default 4', title:'string?' }},
  { name: 'shift_next_event', description:'Geser event terdekat beberapa menit (+/-)', params:{ minutes:'int' }},
  { name: 'add_goal', description:'Tambahkan goal baru', params:{ title:'string', target_date:'date?' }},
  { name: 'update_goal_progress', description:'Update progress goal', params:{ goal_id:'uuid/int', progress:'0-100 number'} },
  { name: 'generate_daily_summary', description:'Bangun ringkasan harian', params:{} },
  { name: 'evaluate_day', description:'Evaluasi hari ini', params:{} }
  ,{ name: 'generate_subtasks', description:'Buat parent task dan pecah menjadi beberapa subtask', params:{ parent_title:'string', count:'int? default 3' } }
  ,{ name: 'prioritize_tasks', description:'Hitung skor prioritas untuk seluruh tasks', params:{} }
  ,{ name: 'suggest_next_task', description:'Rekomendasi task berikutnya berdasarkan skor', params:{} }
  ,{ name: 'focus_today', description:'Ambil 3 task fokus utama hari ini', params:{} }
  ,{ name: 'memory_summary', description:'Ringkas memory agent terakhir', params:{} }
  ,{ name: 'auto_schedule_top_tasks', description:'Otomatis blok waktu untuk beberapa task prioritas siang ini', params:{ count:'int? default 2' }}
  ,{ name: 'detect_stagnant_tasks', description:'Deteksi task mandek >= X jam', params:{ hours:'int? default 48' }}
  ,{ name: 'progress_overview', description:'Ringkasan progres (done vs total)', params:{} }
  ,{ name: 'refine_task_title', description:'Refinasi judul task agar jelas & action oriented', params:{ raw_title:'string', style:'string? (singkat|detail)' }}
  ,{ name: 'task_brief', description:'Bangun micro brief (why, outcome, steps) untuk sebuah task', params:{ title:'string' }}
  ,{ name: 'explain_priorities', description:'Penjelasan ringkas kenapa 5 task teratas diprioritaskan', params:{} }
  ,{ name: 'plan_day', description:'Rencana garis besar blok fokus hari ini (JSON timeline)', params:{} }
  ,{ name: 'generate_task_explanation', description:'Buat penjelasan AI singkat dan simpan ke task', params:{ task_id:'uuid' }}
];

export function getFunctionMeta(name){
  return functionRegistry.find(f=>f.name===name);
}

export function isCallable(name){
  return !!exposedFunctions[name];
}

export function listCallable(){
  return functionRegistry.filter(f=> isCallable(f.name));
}