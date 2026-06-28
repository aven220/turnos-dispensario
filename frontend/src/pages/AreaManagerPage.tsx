import { useEffect, useState } from 'react';
import { WindowsManager } from '../components/WindowsManager';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Priority, Window } from '../types';

export function AreaManagerPage() {
  const { token } = useAuth();
  const [windows, setWindows] = useState<Window[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  async function loadAll() {
    const [w, p] = await Promise.all([
      api<Window[]>('/windows'),
      api<Priority[]>('/priorities'),
    ]);
    setWindows(w);
    setPriorities(p);
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 20000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <Layout title="Jefe de área — Ventanillas">
      <p className="text-sm text-slate-600 mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        Configure el nombre, estado y orden de prioridades de cada ventanilla. No puede crear ventanillas ni gestionar usuarios.
      </p>
      <WindowsManager
        windows={windows}
        priorities={priorities}
        operators={[]}
        onRefresh={loadAll}
        areaManagerMode
      />
    </Layout>
  );
}
