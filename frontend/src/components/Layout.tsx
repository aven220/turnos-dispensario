import { Link } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { useAuth } from '../context/AuthContext';

export function Layout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {user && user.role !== 'ADMIN' && (
            <p className="text-sm text-slate-300">{user.fullName} · {user.role}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/admin" className="text-sm hover:text-blue-300">Panel</Link>
              <Link to="/tv" className="text-sm hover:text-blue-300" target="_blank">TV</Link>
              <AccountMenu />
            </>
          )}
          {user && user.role !== 'ADMIN' && (
            <button onClick={logout} className="text-sm bg-slate-700 px-3 py-1.5 rounded hover:bg-slate-600">
              Salir
            </button>
          )}
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
