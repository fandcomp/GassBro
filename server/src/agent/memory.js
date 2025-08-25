import { supabase } from '../services/supabase.js';

// Table schema suggestion (run in Supabase):
// create table agent_memory (
//   id uuid default gen_random_uuid() primary key,
//   ts timestamptz default now(),
//   role text not null, -- user | assistant | system | action
//   content text,
//   intent jsonb,
//   action jsonb,
//   result jsonb
// );

export async function remember(entry){
  const { error } = await supabase.from('agent_memory').insert(entry);
  if (error) console.error('[agent:remember] error', error);
}

export async function recentMemory(limit=15){
  const { data, error } = await supabase.from('agent_memory').select('*').order('ts',{ ascending:false }).limit(limit);
  if (error) { console.error('[agent:recentMemory]', error); return []; }
  return data.reverse();
}
