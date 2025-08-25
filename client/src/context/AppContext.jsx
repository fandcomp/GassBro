import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchSummary() {
    setLoading(true);
    try {
      const res = await api.callFunction('generate_daily_summary', { date: new Date().toISOString().slice(0,10) });
      setSummary(res);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchSummary(); },[]);

  const value = { summary, tasks, setTasks, refreshSummary: fetchSummary, loading };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { return useContext(AppContext); }
