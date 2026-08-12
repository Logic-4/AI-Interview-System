import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2, UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import superadminService, { SystemUser, SystemUserPayload, SystemUserRole } from '@/services/superadminService';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getErrorMessage } from '@/lib/utils';

const ROLES: SystemUserRole[] = ['user', 'company'];
const blankForm: SystemUserPayload = { name: '', email: '', password: '', role: 'user', status: 'active' };
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
const errMsg = (error: unknown) => getErrorMessage(error);

const PasswordInput = ({ id, value, onChange, placeholder, required = false }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; required?: boolean }) => {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><input id={id} type={visible ? 'text' : 'password'} className="form-input w-full pr-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required} minLength={required ? 8 : undefined} /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white-dark hover:text-primary" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide' : 'Show'}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>;
};

const UsersPage = () => {
  const dispatch = useDispatch();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<SystemUserPayload>(blankForm);
  const [saving, setSaving] = useState(false);
  const [passwordUser, setPasswordUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteUser, setDeleteUser] = useState<SystemUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await superadminService.listUsers({ page, limit: 10, search, role: roleFilter, status: statusFilter });
      setUsers(result.users);
      setTotal(result.pagination.total);
    } catch (error) { toast.error(errMsg(error)); }
    finally { setLoading(false); }
  };

  useEffect(() => { dispatch(setPageTitle('Users | Superadmin')); }, [dispatch]);
  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 250); return () => window.clearTimeout(t); }, [page, search, roleFilter, statusFilter]);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const openCreate = () => { setEditing(null); setForm(blankForm); setFormOpen(true); };
  const openEdit = (u: SystemUser) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role !== 'admin' ? u.role : 'user', status: u.accountStatus }); setFormOpen(true); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) {
        await superadminService.updateUser(editing._id, { name: form.name, email: form.email, role: form.role });
      } else {
        await superadminService.createUser(form);
      }
      toast.success(editing ? 'User updated.' : 'User created.');
      setFormOpen(false);
      await load();
    } catch (error) { toast.error(errMsg(error)); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (user: SystemUser) => {
    const next = user.accountStatus === 'active' ? 'disabled' : 'active';
    try { await superadminService.updateUserStatus(user._id, next); toast.success(`User ${next}.`); await load(); }
    catch (error) { toast.error(errMsg(error)); }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault(); if (!passwordUser) return; setActionLoading(true);
    try { await superadminService.resetUserPassword(passwordUser._id, newPassword); toast.success('Password reset.'); setPasswordUser(null); setNewPassword(''); }
    catch (error) { toast.error(errMsg(error)); }
    finally { setActionLoading(false); }
  };

  const remove = async () => {
    if (!deleteUser) return; setActionLoading(true);
    try { await superadminService.deleteUser(deleteUser._id); toast.success('User deleted.'); setDeleteUser(null); if (users.length === 1 && page > 1) setPage(page - 1); else await load(); }
    catch (error) { toast.error(errMsg(error)); }
    finally { setActionLoading(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold text-black dark:text-white">Users</h1><p className="mt-1 text-sm text-white-dark">Manage platform users.</p></div>
      <button className="btn btn-primary" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add user</button>
    </div>
    <div className="panel">
      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" /><input className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder="Search name or email" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} /></div>
        <select className="form-select md:w-40" value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}><option value="">All roles</option><option value="user">User</option><option value="company">Company</option><option value="admin">Admin (legacy)</option></select>
        <select className="form-select md:w-40" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
      </div>
      {loading ? <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div> : <>
        <div className="table-responsive"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th className="text-right">Actions</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u._id}>
            <td><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-primary/10 text-primary"><UserIcon className="h-4 w-4" /></span><div><p className="font-semibold text-black dark:text-white">{u.name}</p><p className="text-xs text-white-dark">{u.email}</p></div></div></td>
            <td><span className="capitalize">{u.role}</span></td>
            <td><span className={`badge badge-outline-${u.accountStatus === 'active' ? 'success' : 'danger'}`}>{u.accountStatus}</span></td>
            <td>{dateTime(u.lastLogin)}</td>
            <td>{dateTime(u.createdAt)}</td>
            <td><div className="flex justify-end gap-1">
              <button title="Edit user" className="btn btn-sm btn-outline-secondary p-2" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></button>
              <button title="Reset password" className="btn btn-sm btn-outline-warning p-2" onClick={() => { setNewPassword(''); setPasswordUser(u); }}><KeyRound className="h-4 w-4" /></button>
              {u.accountStatus === 'active' ? <button className="btn btn-sm btn-outline-warning" onClick={() => void toggleStatus(u)}>Disable</button> : <button className="btn btn-sm btn-outline-success" onClick={() => void toggleStatus(u)}>Enable</button>}
              <button title="Delete user" className="btn btn-sm btn-outline-danger p-2" onClick={() => setDeleteUser(u)}><Trash2 className="h-4 w-4" /></button>
            </div></td>
          </tr>)}
          {users.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-white-dark">No users match your filters.</td></tr>}
          </tbody></table></div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-white-dark">{total} {total === 1 ? 'user' : 'users'}</span>
          <div className="flex items-center gap-2"><button className="btn btn-outline-primary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="btn btn-outline-primary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      </>}
    </div>

    <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit user' : 'Create user'} description={editing ? 'Update user details.' : 'Add a new platform user.'} size="md">
      <form className="space-y-4" onSubmit={submit}>
        <div><label htmlFor="user-name">Full name</label><input id="user-name" name="name" className="form-input" placeholder="Full name" value={form.name} onChange={onChange} required /></div>
        <div><label htmlFor="user-email">Email</label><input id="user-email" name="email" type="email" className="form-input" placeholder="user@example.com" value={form.email} onChange={onChange} required /></div>
        <div><label htmlFor="user-role">Role</label><select id="user-role" name="role" className="form-select" value={form.role} onChange={onChange}>{ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
        {!editing && <div><label htmlFor="user-password">Password</label><PasswordInput id="user-password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="8+ characters, mixed case, number" required /><p className="mt-1 text-xs text-white-dark">Use 8+ characters with uppercase, lowercase, and a number.</p></div>}
        {!editing && <div><label htmlFor="user-status">Status</label><select id="user-status" name="status" className="form-select" value={form.status} onChange={onChange}><option value="active">Active</option><option value="disabled">Disabled</option></select></div>}
        <div className="flex justify-end gap-3 pt-3"><button type="button" className="btn btn-outline-danger" onClick={() => setFormOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create user'}</button></div>
      </form>
    </Modal>

    <Modal open={!!passwordUser} onOpenChange={(open) => { if (!open) { setPasswordUser(null); setNewPassword(''); } }} title="Reset user password" description={passwordUser ? `Set a new password for ${passwordUser.name}.` : undefined} size="md">
      <form className="space-y-4" onSubmit={resetPassword}>
        <div><label htmlFor="reset-user-password">New password</label><PasswordInput id="reset-user-password" value={newPassword} onChange={setNewPassword} placeholder="8+ characters, mixed case, number" required /><p className="mt-1 text-xs text-white-dark">Existing sessions will be revoked.</p></div>
        <div className="flex justify-end gap-3 pt-3"><button type="button" className="btn btn-outline-danger" onClick={() => setPasswordUser(null)}>Cancel</button><button className="btn btn-warning" disabled={actionLoading}>{actionLoading ? 'Resetting...' : 'Reset password'}</button></div>
      </form>
    </Modal>

    <Modal open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }} title="Delete user" description={deleteUser ? `Permanently delete ${deleteUser.name}?` : undefined} size="md">
      <div className="space-y-4"><p className="text-sm text-white-dark">This permanently removes the account. This action cannot be undone.</p><div className="flex justify-end gap-3 pt-3"><button className="btn btn-outline-primary" onClick={() => setDeleteUser(null)}>Cancel</button><button className="btn btn-danger" disabled={actionLoading} onClick={() => void remove()}>{actionLoading ? 'Deleting...' : 'Delete user'}</button></div></div>
    </Modal>
  </div>;
};

export default UsersPage;
