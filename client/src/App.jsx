import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DailySummaryCard from './components/Dashboard/DailySummaryCard.jsx';
import TaskList from './components/Dashboard/TaskList.jsx';
import GoalList from './components/Dashboard/GoalList.jsx';
import CalendarView from './components/Dashboard/CalendarView.jsx';
import AssistantPanel from './components/Assistant/AssistantPanel.jsx';
import AgentExecutionPanel from './components/Assistant/AgentExecutionPanel.jsx';
import FocusTimer from './components/FocusTimer/FocusTimer.jsx';
import FocusPanel from './components/Dashboard/FocusPanel.jsx';
import ProgressInsight from './components/Dashboard/ProgressInsight.jsx';
import TrendAnalytics from './components/Dashboard/TrendAnalytics.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';
import { toggleDarkMode } from './theme.js';

function DashboardPage() {
  return (
    <>
      <section className="card-grid">
        <div className="glass p-5 gradient-border animate-fadeScaleIn"><DailySummaryCard /></div>
        <div className="glass p-5 gradient-border animate-fadeScaleIn"><TaskList /></div>
        <div className="glass p-5 gradient-border animate-fadeScaleIn"><GoalList /></div>
  <div className="glass p-5 gradient-border animate-fadeScaleIn"><FocusPanel /></div>
  <div className="glass p-5 gradient-border animate-fadeScaleIn"><ProgressInsight /></div>
  <div className="glass p-5 gradient-border animate-fadeScaleIn"><TrendAnalytics /></div>
        <div className="glass p-5 gradient-border animate-fadeScaleIn col-span-full"><CalendarView /></div>
        <div className="glass p-5 gradient-border animate-fadeScaleIn col-span-full"><FocusTimer /></div>
      </section>
    </>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const [enableTransitions, setEnableTransitions] = React.useState(()=>{
    const stored = localStorage.getItem('enableTransitions');
    return stored === null ? false : stored === 'true';
  });
  function toggleTransitions(){
    setEnableTransitions(v=>{ const nv = !v; localStorage.setItem('enableTransitions', nv ? 'true':'false'); return nv; });
  }
  return (
    <div className="relative min-h-full px-6 py-8 md:px-10 max-w-7xl mx-auto page-container">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold gradient-text tracking-tight">GassBro Productivity</h1>
          <p className="text-sm text-slate-400 mt-1">Agentic AI Dashboard • Fokus • Terarah • Elegan</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <nav className="flex gap-2 text-xs font-medium bg-white/40 dark:bg-white/5 backdrop-blur px-2 py-1 rounded-full border border-white/20">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/timer">Focus Timer</NavLink>
          </nav>
          <button onClick={toggleDarkMode} className="btn-ghost mode-rotate" aria-label="Toggle Theme">🌗</button>
          <button className="btn" onClick={()=>window.location.reload()}>Refresh</button>
        </div>
      </header>
      <div className="flex gap-2 mb-2 -mt-4 flex-wrap text-[10px] text-slate-500">
        <button onClick={toggleTransitions} className="btn-ghost text-[10px] px-2 py-1">
          Transisi: {enableTransitions ? 'ON':'OFF'}
        </button>
      </div>
      <PageTransition locationKey={location.pathname} disabled={!enableTransitions}>
        {children}
      </PageTransition>
      <AssistantPanel />
  <AgentExecutionPanel />
    </div>
  );
}

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return <Link className={`px-3 py-1.5 rounded-full transition ${active? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow':'hover:bg-white/60 dark:hover:bg-white/10'}`} to={to}>{children}</Link>;
}

function PageTransition({ children, locationKey, disabled }) {
  if (disabled) return <div>{children}</div>;
  const [items, setItems] = React.useState([{ key: locationKey, node: children, state: 'enter'}]);
  React.useEffect(()=>{
    setItems(curr => {
      const exists = curr.find(i=>i.key===locationKey);
      if(exists) return curr;
      return [...curr.map(i=> ({ ...i, state:'exit'})), { key: locationKey, node: children, state:'enter'}];
    });
  },[locationKey, children]);
  React.useEffect(()=>{
    const timers = items.map(item => {
      if(item.state==='exit') {
        return setTimeout(()=>{
          setItems(curr => curr.filter(c=>c.key!==item.key));
        }, 400);
      }
      return null;
    });
    return ()=> timers.forEach(t=> t && clearTimeout(t));
  },[items]);
  return (
    <div className="page-transition-root">
      {items.map(item => {
        const cls = item.state==='enter'
          ? 'page-transition-layer page-fade-enter page-fade-enter-active'
          : 'page-transition-layer page-fade-exit page-fade-exit-active';
        const style = item.state==='exit'? { pointerEvents:'none'} : {};
        return (
          <div key={item.key} className={cls} style={style}>
            {item.node}
          </div>
        );
      })}
    </div>
  );
}

function TimerPage(){
  return <div className="grid md:grid-cols-2 gap-8"> <FocusTimer /> <div className="glass p-5 gradient-border animate-fadeScaleIn"><TaskList /></div> </div>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/timer" element={<TimerPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}

// Debug helper (optional) - highlight positioned elements blocking clicks when user presses Ctrl+Alt+O
if (typeof window !== 'undefined' && !window.__overlayDebuggerInstalled) {
  window.__overlayDebuggerInstalled = true;
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'o') {
      const els = Array.from(document.body.querySelectorAll('*'));
      els.forEach(el => { if (el.__oldOutline) { el.style.outline = el.__oldOutline; delete el.__oldOutline; }});
      const blocking = els.filter(el => {
        const style = getComputedStyle(el);
        if (style.pointerEvents === 'none') return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const pos = style.position;
        if (!['fixed','absolute'].includes(pos)) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return false;
        if (rect.top>window.innerHeight || rect.left>window.innerWidth || rect.bottom<0 || rect.right<0) return false;
        return true;
      });
      blocking.forEach(el => { el.__oldOutline = el.style.outline; el.style.outline = '2px solid #ef4444'; });
      console.log('[Overlay Debugger] Highlighted elements:', blocking);
    }
  });
}
