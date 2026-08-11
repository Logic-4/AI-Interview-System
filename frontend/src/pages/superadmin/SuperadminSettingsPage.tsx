import { FormEvent, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { setPageTitle } from '@/store/themeConfigSlice';
import { useAuthStore } from '@/stores/authStore';
import superadminService from '@/services/superadminService';
import { User } from '@/types/user';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || 'Something went wrong.' : 'Something went wrong.';

const SuperadminSettingsPage = () => {
  const dispatch = useDispatch();
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle('Superadmin Settings | InterviewAI'));
    superadminService.getProfile().then((user) => { setProfile(user); setName(user.name); setEmail(user.email); }).catch((error) => toast.error(errorMessage(error)));
  }, [dispatch]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100)
      return toast.error('Name must be 2–100 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return toast.error('Please enter a valid email address');
    setSavingProfile(true);
    try { const user = await superadminService.updateProfile({ name: trimmedName, email: email.trim() }); setProfile(user); setUser(user); toast.success('Profile updated.'); }
    catch (error) { toast.error(errorMessage(error)); } finally { setSavingProfile(false); }
  };
  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return toast.error('New passwords do not match.');
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    setSavingPassword(true);
    try { await superadminService.updatePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); toast.success('Password updated. Sign in again on your next session.'); }
    catch (error) { toast.error(errorMessage(error)); } finally { setSavingPassword(false); }
  };

  if (!profile) return <div className="flex h-96 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-black dark:text-white">Profile & Security</h1><p className="mt-1 text-sm text-white-dark">Manage your superadmin identity and sign-in credentials.</p></div>
    <div className="grid gap-6 xl:grid-cols-3"><div className="panel xl:col-span-2"><div className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></span><div><h2 className="font-bold text-black dark:text-white">Profile information</h2><p className="text-sm text-white-dark">Your name and platform administrator email.</p></div></div><form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={saveProfile}><div><label htmlFor="superadmin-name">Full name</label><input id="superadmin-name" className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Platform Administrator" required /></div><div><label htmlFor="superadmin-email">Email address</label><input id="superadmin-email" type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@yourcompany.com" required /></div><div className="sm:col-span-2"><button className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save profile'}</button></div></form></div>
      <div className="panel"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-success/10 text-success"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold text-black dark:text-white">Account details</h2><p className="text-sm text-white-dark">Platform-level access</p></div></div><div className="mt-6 space-y-3 text-sm"><div><p className="text-white-dark">Role</p><span className="badge badge-outline-primary mt-1">Superadmin</span></div><div><p className="text-white-dark">Last sign-in</p><p className="font-semibold text-black dark:text-white">{profile.lastLogin ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.lastLogin)) : 'No recorded sign-in'}</p></div><div><p className="text-white-dark">Account created</p><p className="font-semibold text-black dark:text-white">{profile.createdAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(profile.createdAt)) : '—'}</p></div></div></div></div>
    <div className="panel"><div className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-warning/10 text-warning"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-bold text-black dark:text-white">Change password</h2><p className="text-sm text-white-dark">Changing your password revokes existing refresh sessions for security.</p></div></div><form className="grid grid-cols-1 gap-5 md:grid-cols-3" onSubmit={savePassword}><div><label htmlFor="current-password">Current password</label><input id="current-password" type="password" className="form-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Your current password" required /></div><div><label htmlFor="new-password">New password</label><input id="new-password" type="password" className="form-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="8+ characters, mixed case, number" required minLength={8} /></div><div><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" className="form-input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your new password" required minLength={8} /></div><div className="md:col-span-3"><button className="btn btn-primary" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Update password'}</button></div></form></div>
  </div>;
};

export default SuperadminSettingsPage;
