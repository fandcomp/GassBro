import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/events`);
      setEvents(data);
    } finally { setLoading(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (!title || !start || !end) return;
    await fetch(`${API_BASE}/fn/schedule_event`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, datetime_start: start, datetime_end: end })});
    setTitle(''); setStart(''); setEnd('');
    load();
  }
  function startEdit(ev){
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditStart(ev.start_time ? ev.start_time.slice(0,16):'');
    setEditEnd(ev.end_time ? ev.end_time.slice(0,16):'');
  }
  function cancelEdit(){ setEditingId(null); }
  async function saveEdit(e){
    e.preventDefault();
    const resp = await fetch(`${API_BASE}/events/${editingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: editTitle, start_time: editStart, end_time: editEnd })});
    if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); alert('Update gagal: '+(err.error||'')); return; }
    console.log('Update event OK');
    setEditingId(null); load();
  }
  async function removeEvent(id){ if(!confirm('Hapus event?')) return; const resp = await fetch(`${API_BASE}/events/${id}`, { method:'DELETE' }); if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); alert('Delete gagal: '+(err.error||'')); return;} console.log('Delete event OK'); load(); }
  useEffect(()=>{ load(); },[]);

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Calendar (List)</h2>
        <div className="flex items-center gap-2">
          <button onClick={async()=>{ if(confirm('Hapus SEMUA events?')){ await fetch(`${API_BASE}/fn/reset_all_events`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'}); load(); }}} className="text-[10px] px-2 py-1 rounded bg-red-600/80 text-white hover:bg-red-600">Reset</button>
          <button onClick={load} className="text-xs text-brand-600">Refresh</button>
        </div>
      </div>
      <form onSubmit={add} className="grid grid-cols-2 gap-2 text-xs">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Event" className="col-span-2 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1" />
        <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1" />
        <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1" />
        <button className="col-span-2 justify-self-start px-3 py-1 rounded bg-brand-600 text-white">Add</button>
      </form>
      {loading ? (
        <div className="skeleton-list text-xs">
          <div className="skeleton-block h-10"></div>
          <div className="skeleton-block h-10"></div>
          <div className="skeleton-block h-10"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-auto pr-1 text-xs">
          {events.map(ev => (
            <div key={ev.id} className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 flex flex-col gap-1">
              {editingId === ev.id ? (
                <form onSubmit={saveEdit} className="flex flex-col gap-1">
                  <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="bg-white/10 dark:bg-slate-600 rounded px-2 py-1" />
                  <div className="grid grid-cols-2 gap-1">
                    <input type="datetime-local" value={editStart} onChange={e=>setEditStart(e.target.value)} className="bg-white/10 dark:bg-slate-600 rounded px-2 py-1" />
                    <input type="datetime-local" value={editEnd} onChange={e=>setEditEnd(e.target.value)} className="bg-white/10 dark:bg-slate-600 rounded px-2 py-1" />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded">Simpan</button>
                    <button type="button" onClick={cancelEdit} className="text-[10px] bg-slate-400/40 px-2 py-1 rounded">Batal</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="font-medium flex justify-between items-center">
                    <span>{ev.title}</span>
                    <div className="flex gap-1">
                      <button onClick={()=>startEdit(ev)} className="text-[10px] px-2 py-0.5 rounded bg-white/30 dark:bg-slate-500/60 hover:bg-white/40">Edit</button>
                      <button onClick={()=>removeEvent(ev.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/70 text-white hover:bg-red-500">Hapus</button>
                    </div>
                  </div>
                  <div className="opacity-60">{dayjs(ev.start_time).format('DD/MM HH:mm')} - {dayjs(ev.end_time).format('HH:mm')}</div>
                </>
              )}
            </div>
          ))}
          {events.length===0 && <div className="opacity-60">Belum ada event.</div>}
        </div>
      )}
    </div>
  );
}
