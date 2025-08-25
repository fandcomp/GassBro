import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '../../services/api';

export default function GoalList() {
  const [goals, setGoals] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/goals`);
      setGoals(data);
    } finally { setLoading(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.callFunction('add_goal', { title: title.trim(), target_date: target || null });
    setTitle(''); setTarget('');
    load();
  }
  async function increment(g) {
    const next = Math.min(100, (g.progress || 0) + 10);
  await api.callFunction('update_goal_progress', { goal_id: g.id, progress: next });
  setLastUpdated(g.id + ':' + next);
  load();
  }
  function startEdit(g){ setEditingId(g.id); setEditTitle(g.title); setEditTarget(g.target_date || ''); }
  function cancelEdit(){ setEditingId(null); }
  async function saveEdit(e){
    e.preventDefault();
    const resp = await fetch(`${API_BASE}/goals/${editingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: editTitle, target_date: editTarget || null })});
    if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); alert('Update gagal: '+(err.error||'')); return; }
    console.log('Update goal OK');
    setEditingId(null); load();
  }
  async function removeGoal(id){ if(!confirm('Hapus goal?')) return; const resp = await fetch(`${API_BASE}/goals/${id}`, { method:'DELETE' }); if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); alert('Delete gagal: '+(err.error||'')); return;} console.log('Delete goal OK'); load(); }

  useEffect(()=>{ load(); },[]);

  return (
    <div className="flex flex-col gap-4 animate-fadeScaleIn">
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Goals</h2>
        <div className="flex gap-2">
          <button onClick={async()=>{ if(confirm('Hapus SEMUA goals?')){ try { await api.callFunction('reset_all_goals',{}); load(); } catch(e){ alert(e.response?.data?.error||e.message);} }}} className="text-[10px] px-2 py-1 rounded bg-red-600/80 text-white hover:bg-red-600">Reset</button>
          <button onClick={load} className="btn-ghost text-xs">↻</button>
        </div>
      </div>
      <form onSubmit={add} className="flex flex-col gap-3 text-xs bg-white/5 border border-white/10 rounded-xl p-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Goal..." className="rounded-lg bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-400" />
        <input type="date" value={target} onChange={e=>setTarget(e.target.value)} className="rounded-lg bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-400" />
        <button className="btn !text-xs !px-3 !py-1.5">Add</button>
      </form>
      {loading && (
        <div className="skeleton-list">
          <div className="skeleton-block skeleton-goal"></div>
          <div className="skeleton-block skeleton-goal"></div>
        </div>
      )}
      <div className="flex flex-col gap-3 max-h-64 overflow-auto pr-1">
        {goals.map(g => {
          const pct = g.progress || 0;
          const glow = (lastUpdated && lastUpdated.startsWith(g.id+':')) ? 'glow' : '';
          return (
            <div key={g.id} className="text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-3 flex flex-col gap-2">
              {editingId === g.id ? (
                <form onSubmit={saveEdit} className="flex flex-col gap-2">
                  <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="bg-white/10 rounded px-2 py-1" />
                  <input type="date" value={editTarget} onChange={e=>setEditTarget(e.target.value)} className="bg-white/10 rounded px-2 py-1" />
                  <div className="flex gap-2">
                    <button className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded">Simpan</button>
                    <button type="button" onClick={cancelEdit} className="text-[10px] bg-slate-400/40 px-2 py-1 rounded">Batal</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-100 text-sm truncate">{g.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{pct}%</span>
                      <button onClick={()=>increment(g)} className="btn-ghost text-[10px] px-2 py-1">+10%</button>
                    </div>
                  </div>
                  <div className="goal-progress-shell">
                    <div className={`goal-progress-bar ${glow}`} style={{ width: pct + '%' }} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    {g.target_date && <div className="opacity-40">Target: {g.target_date}</div>}
                    <button onClick={()=>startEdit(g)} className="px-2 py-0.5 rounded bg-white/20 border border-white/20 hover:bg-white/30">Edit</button>
                    <button onClick={()=>removeGoal(g.id)} className="px-2 py-0.5 rounded bg-red-500/70 text-white hover:bg-red-500">Hapus</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!loading && goals.length===0 && <div className="text-xs opacity-60">Belum ada goal.</div>}
      </div>
    </div>
  );
}
