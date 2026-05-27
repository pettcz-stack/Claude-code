import { useEffect, useMemo, useState } from 'react';
import { Shield, UserPlus, Save, Trash2, KeyRound, X, AlertTriangle, Search } from 'lucide-react';
import { api, type AccessAdminUser } from './api.js';
import { useT } from './i18n/index.js';
import { useSort, SortHeader } from './tableSort.js';

type Role = 'ADMIN' | 'MANAGER' | 'IT' | 'VIEWER';

const ROLE_OPTIONS: { value: Role; labelKey: string; descKey: string; badge: string }[] = [
  { value: 'ADMIN', labelKey: 'access.roleAdmin', descKey: 'access.roleAdminDesc', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'MANAGER', labelKey: 'access.roleManager', descKey: 'access.roleManagerDesc', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'IT', labelKey: 'access.roleIT', descKey: 'access.roleITDesc', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
  { value: 'VIEWER', labelKey: 'access.roleViewer', descKey: 'access.roleViewerDesc', badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
];

export function AccessControlView() {
  const { t } = useT();
  const [users, setUsers] = useState<AccessAdminUser[] | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccessAdminUser | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.username.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);
  const { sorted: sortedUsers, key, dir, setSort } = useSort(filteredUsers, 'username', 'asc');

  async function reload() {
    try {
      const [u, d] = await Promise.all([api.accessUsers(), api.accessDepartments()]);
      setUsers(u.users);
      setDepartments(d.departments);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => { reload(); }, []);

  async function handleDelete(u: AccessAdminUser) {
    if (!window.confirm(t('access.deleteConfirm', { name: u.username }))) return;
    try {
      await api.accessDelete(u.id);
      reload();
    } catch (e) {
      const m = String(e);
      if (m.includes('last_admin')) setError(t('access.errorLastAdmin'));
      else if (m.includes('cannot_delete_self')) setError(t('access.errorSelfDelete'));
      else setError(String(e));
    }
  }

  return (
    <div className="space-y-4">
      <header className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Shield size={18} className="text-emerald-600" />
          {t('access.title')}
        </h2>
        <p className="mt-1 text-sm muted-2">{t('access.subtitle')}</p>
      </header>

      {/* Legenda rolí */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('access.rolesLegendTitle')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map((r) => (
            <div key={r.value} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700">
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${r.badge}`}>{t(r.labelKey)}</span>
              <span className="text-xs muted-2">{t(r.descKey)}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="card flex items-start gap-3 border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {/* Seznam admin účtů */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('access.accountsTitle')}</h3>
          <button onClick={() => setEditing('new')} className="btn-primary text-sm">
            <UserPlus size={14} /> {t('access.createNew')}
          </button>
        </div>

        {!users && <p className="text-sm muted-2">{t('common.loading')}</p>}
        {users && users.length === 0 && <p className="text-sm muted-2">{t('access.empty')}</p>}

        {users && users.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Search size={14} className="muted-2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('access.searchPlaceholder')} className="field w-56" />
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setRoleFilter('ALL')} className={`btn-ghost text-xs ${roleFilter === 'ALL' ? 'ring-1 ring-emerald-400' : ''}`}>{t('common.all')}</button>
                {ROLE_OPTIONS.map((r) => (
                  <button key={r.value} onClick={() => setRoleFilter(r.value)} className={`btn-ghost text-xs ${roleFilter === r.value ? 'ring-1 ring-emerald-400' : ''}`}>{t(r.labelKey)}</button>
                ))}
              </div>
              <span className="text-xs muted-2">{t('common.shownOfTotal', { shown: sortedUsers.length, total: users.length })}</span>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <SortHeader sortKey="username" current={key} dir={dir} onChange={setSort}>{t('access.colUsername')}</SortHeader>
                  <SortHeader sortKey="fullName" current={key} dir={dir} onChange={setSort}>{t('access.colFullName')}</SortHeader>
                  <SortHeader sortKey="role" current={key} dir={dir} onChange={setSort}>{t('access.colRole')}</SortHeader>
                  <th className="th">{t('access.colDepartments')}</th>
                  <SortHeader sortKey="active" current={key} dir={dir} onChange={setSort}>{t('access.colStatus')}</SortHeader>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => {
                  const roleInfo = ROLE_OPTIONS.find((r) => r.value === u.role);
                  return (
                    <tr key={u.id} className="divide-row">
                      <td className="td font-medium">{u.username}</td>
                      <td className="td muted">{u.fullName ?? '—'}</td>
                      <td className="td">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleInfo?.badge ?? ''}`}>
                          {roleInfo ? t(roleInfo.labelKey) : u.role}
                        </span>
                      </td>
                      <td className="td text-xs">
                        {u.role === 'MANAGER'
                          ? (u.departments.length > 0 ? u.departments.join(', ') : <span className="text-red-600">{t('access.noDeptsWarning')}</span>)
                          : <span className="muted-2">—</span>}
                      </td>
                      <td className="td">
                        <span className={u.active ? 'chip-work' : 'chip-neutral'}>{u.active ? t('common.active') : t('common.paused')}</span>
                      </td>
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditing(u)} className="btn-ghost text-xs" title={t('common.edit')}>
                            <KeyRound size={13} /> {t('common.edit')}
                          </button>
                          <button onClick={() => handleDelete(u)} className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('common.delete')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 && <tr><td colSpan={6} className="td py-6 text-center muted-2">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {editing && (
        <EditDialog
          user={editing === 'new' ? null : editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function EditDialog({ user, departments, onClose, onSaved, onError }: {
  user: AccessAdminUser | null; // null = vytváření nového
  departments: string[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useT();
  const isNew = !user;
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>((user?.role as Role) ?? 'MANAGER');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [active, setActive] = useState(user?.active ?? true);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set(user?.departments ?? []));
  const [busy, setBusy] = useState(false);

  function toggleDept(d: string) {
    const next = new Set(selectedDepts);
    if (next.has(d)) next.delete(d); else next.add(d);
    setSelectedDepts(next);
  }

  async function submit() {
    if (isNew && password.length < 10) {
      onError(t('access.errorPasswordShort'));
      return;
    }
    setBusy(true);
    try {
      const depts = role === 'MANAGER' ? Array.from(selectedDepts) : [];
      if (isNew) {
        await api.accessCreate({ username, password, role, fullName: fullName || undefined, email: email || undefined, departments: depts });
      } else {
        await api.accessUpdate(user!.id, {
          role,
          fullName: fullName || null,
          email: email || null,
          active,
          departments: depts,
          newPassword: password.length >= 10 ? password : undefined,
        });
      }
      onSaved();
    } catch (e) {
      const m = String(e);
      if (m.includes('username_exists')) onError(t('access.errorUsernameExists'));
      else onError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{isNew ? t('access.createTitle') : t('access.editTitle', { name: user!.username })}</h3>
          <button onClick={onClose} className="btn-ghost"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs muted">{t('access.colUsername')} *</span>
            <input value={username} disabled={!isNew} onChange={(e) => setUsername(e.target.value)} className="field w-full" autoFocus={isNew} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs muted">{t('access.colFullName')}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="field w-full" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs muted">{t('access.colEmail')}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field w-full" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs muted">{isNew ? t('access.password') + ' *' : t('access.newPasswordOptional')}</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field w-full" placeholder={isNew ? t('access.passwordMinHint') : t('access.leaveBlank')} />
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs muted">{t('access.role')} *</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.value} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${role === r.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}`}>
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-1" />
                <div>
                  <span className={`text-xs font-medium ${role === r.value ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{t(r.labelKey)}</span>
                  <p className="mt-0.5 text-[11px] muted-2">{t(r.descKey)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {role === 'MANAGER' && (
          <div className="mt-4">
            <label className="mb-2 block text-xs muted">{t('access.allowedDepartments')} *</label>
            {departments.length === 0 ? (
              <p className="text-xs muted-2">{t('access.noDepartmentsAvailable')}</p>
            ) : (
              <div className="grid gap-1.5 max-h-48 overflow-y-auto sm:grid-cols-2">
                {departments.map((d) => (
                  <label key={d} className="flex items-center gap-2 rounded p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <input type="checkbox" checked={selectedDepts.has(d)} onChange={() => toggleDept(d)} />
                    <span className="text-sm">{d}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs muted-2">{t('access.allowedDepartmentsHint')}</p>
          </div>
        )}

        {!isNew && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('access.userActive')}
          </label>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button onClick={submit} disabled={busy || !username || (isNew && !password)} className="btn-primary">
            <Save size={14} /> {isNew ? t('access.create') : t('common.save')}
          </button>
          <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
