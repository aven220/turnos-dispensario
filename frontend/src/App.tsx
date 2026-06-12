import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AdminPage } from './pages/AdminPage';
import { FilterPage } from './pages/FilterPage';
import { LoginPage } from './pages/LoginPage';
import { TvPage } from './pages/TvPage';
import { WindowPage } from './pages/WindowPage';
import type { UserRole } from './types';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/tv" element={<TvPage />} />
      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
      <Route path="/filtro" element={<ProtectedRoute roles={['FILTER', 'ADMIN']}><FilterPage /></ProtectedRoute>} />
      <Route path="/ventanilla" element={<ProtectedRoute roles={['WINDOW']}><WindowPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
