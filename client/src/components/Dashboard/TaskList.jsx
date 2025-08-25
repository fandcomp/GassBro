import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { api } from '../../services/api';
import dayjs from 'dayjs';

const statusOrder = ['pending','in_progress','done','blocked'];

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editPriority, setEditPriority] = useState('important');
  const [errorMsg, setErrorMsg] = useState('');
  // Filter tabs removed per request; always show all tasks
  const prevIdsRef = useRef(new Set());
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

  async function load() {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await axios.get(`${API_BASE}/tasks`);
      data.sort((a,b)=> statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  // Determine newly added ids for animation
  const prevIds = prevIdsRef.current;
  setTasks(data.map(d => ({ ...d, __new: !prevIds.has(d.id) })));
  prevIdsRef.current = new Set(data.map(d=>d.id));
    } catch(e) {
      setErrorMsg(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.callFunction('add_task', { title: title.trim() });
    } catch(e) {
      setErrorMsg(e.response?.data?.error || e.message);
    }
    setTitle('');
    await load();
  }

  async function toggleStatus(task) {
    const next = task.status === 'done' ? 'pending' : 'done';
    try {
      await api.callFunction('update_task_status', { task_id: task.id, status: next });
    } catch(e) {
      setErrorMsg(e.response?.data?.error || e.message);
    } finally { await load(); }
  }

  function startEdit(task){
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDeadline(task.deadline ? task.deadline.slice(0,16) : '');
    setEditPriority(task.priority || 'important');
  }
  function cancelEdit(){ setEditingId(null); }
  async function saveEdit(e){
    e.preventDefault();
    try {
  const resp = await fetch(`${API_BASE}/tasks/${editingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: editTitle, deadline: editDeadline || null, priority: editPriority })});
  if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); throw new Error(err.error||'Update gagal'); }
  console.log('Update task OK');
      setEditingId(null);
      await load();
    } catch(e){ setErrorMsg(e.message); }
  }
  async function removeTask(id){
    if(!confirm('Hapus task?')) return;
    try {
  const resp = await fetch(`${API_BASE}/tasks/${id}`, { method:'DELETE' });
  if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); throw new Error((err.error||'Delete gagal')); }
  console.log('Delete task OK');
      await load();
    } catch(e){ setErrorMsg(e.message); }
  }

  useEffect(()=>{ load(); },[]);

  const grouped = React.useMemo(()=>{
    const parents = tasks.filter(t=>!t.parent_task_id);
    const childrenMap = tasks.filter(t=>t.parent_task_id).reduce((acc,t)=>{ (acc[t.parent_task_id]||(acc[t.parent_task_id]=[])).push(t); return acc; },{});
    return parents.map(p=> ({ parent:p, children: (childrenMap[p.id]||[]).sort((a,b)=> a.created_at.localeCompare(b.created_at)) }));
  }, [tasks]);

  const progress = React.useMemo(()=>{
    if (!tasks.length) return { pct:0, done:0, total:0 };
    const done = tasks.filter(t=> t.status==='done').length;
    return { pct: Math.round((done / tasks.length)*100), done, total: tasks.length };
  },[tasks]);

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <div className="flex items-center gap-2">
          <button onClick={async()=>{ if(confirm('Hapus SEMUA tasks?')){ try { await api.callFunction('reset_all_tasks',{}); await load(); } catch(e){ setErrorMsg(e.response?.data?.error||e.message);} }}} className="text-[10px] px-2 py-1 rounded bg-red-600/80 text-white hover:bg-red-600">Reset</button>
          <button onClick={load} className="text-xs text-brand-600">Refresh</button>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
          <span>Progress</span><span>{progress.done}/{progress.total} ({progress.pct}%)</span>
        </div>
        <div className="h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all" style={{ width: progress.pct+'%' }} />
        </div>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tambah task..." className="flex-1 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 text-xs" />
        <button className="text-xs bg-brand-600 text-white px-3 rounded">Add</button>
      </form>
      {loading && (
        <div className="skeleton-list mt-1">
          <div className="skeleton-block skeleton-task"></div>
          <div className="skeleton-block skeleton-task"></div>
          <div className="skeleton-block skeleton-task"></div>
        </div>
      )}
  {errorMsg && <div className="text-xs text-red-600 dark:text-red-400">{errorMsg}</div>}
      <div className="flex flex-col gap-1 max-h-64 overflow-auto pr-1">
        {grouped.map(g => (
          <React.Fragment key={g.parent.id}>
            {renderTaskRow(g.parent)}
            {g.children.map(ch => (
              <div key={ch.id} className="ml-6 border-l border-slate-500/20 pl-3">
                {renderTaskRow(ch, true)}
              </div>
            ))}
          </React.Fragment>
        ))}
        {!loading && tasks.length===0 && <div className="text-xs opacity-60">Belum ada task.</div>}
      </div>
    </div>
  );

  function renderTaskRow(t, isChild=false){
    return (
      <div className={`task-item ${t.status==='done'?'task-item-done':''} ${t.__new?'task-enter':''}`}>
        <button onClick={()=>toggleStatus(t)} className={`checkbox-btn ${t.status==='done'?'done':''}`} aria-label="Toggle status">
          <svg className="checkbox-svg" viewBox="0 0 16 16"><path className="checkbox-path" d="M3 9l3 3 7-8" /></svg>
        </button>
        {editingId === t.id ? (
          <form onSubmit={saveEdit} className="flex-1 flex flex-col gap-1 text-[11px]">
            <input autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 text-[11px]" />
            <div className="flex gap-1">
              <input type="datetime-local" value={editDeadline} onChange={e=>setEditDeadline(e.target.value)} className="flex-1 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1" />
              <select value={editPriority} onChange={e=>setEditPriority(e.target.value)} className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1">
                <option value="urgent">urgent</option>
                <option value="important">important</option>
                <option value="normal">normal</option>
                <option value="low">low</option>
              </select>
            </div>
            <div className="flex gap-2 mt-1">
              <button type="submit" className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded">Simpan</button>
              <button type="button" onClick={cancelEdit} className="text-[10px] bg-slate-400/40 px-2 py-1 rounded">Batal</button>
            </div>
          </form>
        ) : (
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-[13px] task-title-anim flex items-center gap-2 ${t.status==='done'?'opacity-60':''}`}>
              <span>{t.title}</span>
              {t.status==='done' && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">TERLAKSANA</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {t.deadline && <div className="opacity-40 text-[11px] font-mono">{dayjs(t.deadline).format('DD/MM HH:mm')}</div>}
              <button onClick={()=>startEdit(t)} className="text-[10px] px-2 py-0.5 rounded bg-white/20 border border-white/20 hover:bg-white/30">Edit</button>
              <button onClick={()=>removeTask(t.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/70 text-white hover:bg-red-500">Hapus</button>
              <button onClick={async()=>{ try { const r = await api.callFunction('generate_task_explanation',{ task_id: t.id }); await load(); } catch(e){ setErrorMsg(e.response?.data?.error || e.message);} }} className="text-[10px] px-2 py-0.5 rounded bg-indigo-600/70 text-white hover:bg-indigo-600">AI</button>
            </div>
            {t.ai_explanation && (
              <div className="mt-1 text-[10px] bg-indigo-500/10 border border-indigo-500/20 rounded p-2 leading-relaxed">
                <div className="uppercase tracking-wide text-[9px] font-semibold text-indigo-400 mb-0.5">AI EXPLAIN</div>
                <div className="opacity-80 whitespace-pre-wrap">{t.ai_explanation}</div>
              </div>
            )}
          </div>
        )}
        <span className="text-[9px] uppercase tracking-wide px-2 py-1 rounded-full bg-white/10 border border-white/15">{t.priority}</span>
      </div>
    );
  }
}
