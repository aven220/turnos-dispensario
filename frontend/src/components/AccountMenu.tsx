import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { User } from '../types';

const roleLabels: Record<User['role'], string> = {
  ADMIN: 'Administrador',
  AREA_MANAGER: 'Jefe de área',
  AUDITOR: 'Auditoría',
  FILTER: 'Filtro',
  WINDOW: 'Ventanilla',
};

export function AccountMenu() {
  const { user, setSessionUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setProfileError('');
    setProfileLoading(true);

    const fd = new FormData(form);
    const password = String(fd.get('password') ?? '');
    const payload: Record<string, string> = {
      username: String(fd.get('username') ?? '').trim(),
      fullName: String(fd.get('fullName') ?? '').trim(),
    };
    if (password) payload.password = password;

    try {
      const updated = await api<User>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const pwdInput = form.querySelector<HTMLInputElement>('input[name="password"]');
      if (pwdInput) pwdInput.value = '';
      setSessionUser(updated);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-sm hover:text-blue-300 ${open ? 'text-blue-300' : ''}`}
      >
        Mi cuenta
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 p-4 z-50">
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500 mt-1">
            {roleLabels[user.role]} · @{user.username}
          </p>

          <form
            key={`profile-${user.username}-${user.fullName}`}
            onSubmit={saveProfile}
            className="space-y-3 mt-4 pt-4 border-t border-slate-200"
          >
            <div>
              <label className="block text-xs font-medium mb-1">Nombre completo</label>
              <input
                name="fullName"
                defaultValue={user.fullName}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                minLength={2}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Usuario</label>
              <input
                name="username"
                defaultValue={user.username}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                minLength={3}
                required
              />
            </div>
            {user.role === 'ADMIN' && (
              <div>
                <label className="block text-xs font-medium mb-1">Rol</label>
                <input
                  value="Administrador"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-500"
                  disabled
                  readOnly
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">Nueva contraseña</label>
              <input
                name="password"
                type="password"
                placeholder="Dejar vacío para no cambiar"
                minLength={6}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {profileError && <p className="text-red-600 text-xs">{profileError}</p>}
            <button
              type="submit"
              disabled={profileLoading}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {profileLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>

          <button
            type="button"
            onClick={logout}
            className="w-full mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-800"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
}
