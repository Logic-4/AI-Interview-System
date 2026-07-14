import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { setPageTitle } from '../../store/themeConfigSlice';
import { User, Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import userService from '../../services/userService';
import authService from '../../services/authService';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const SettingsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, setUser, logout } = useAuthStore();
    const [tabs, setTabs] = useState<string>('profile');

    // Profile state
    const [name, setName] = useState(user?.name ?? '');
    const [bio, setBio] = useState(user?.bio ?? '');
    const [targetRole, setTargetRole] = useState(user?.targetRole ?? '');
    const [experienceLevel, setExperienceLevel] = useState<string>(user?.experienceLevel ?? '');
    const [skills, setSkills] = useState(user?.skills?.join(', ') ?? '');
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB.');
            return;
        }

        setUploadingAvatar(true);
        const loadingToast = toast.loading('Uploading profile image...');
        try {
            const updated = await userService.updateAvatar(file);
            setUser(updated);
            toast.success('Profile image updated successfully.', { id: loadingToast });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to upload profile image.', { id: loadingToast });
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPw, setChangingPw] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    // RunPod configuration is managed statically via environment variables (.env)

    useEffect(() => {
        dispatch(setPageTitle('Settings | InterviewAI'));
    }, [dispatch]);

    useEffect(() => {
        if (user) {
            setName(user.name ?? '');
            setBio(user.bio ?? '');
            setTargetRole(user.targetRole ?? '');
            setExperienceLevel(user.experienceLevel ?? '');
            setSkills(user.skills?.join(', ') ?? '');
        }
    }, [user]);



    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updated = await userService.updateProfile({
                name: name.trim(),
                bio: bio.trim(),
                targetRole: targetRole.trim(),
                experienceLevel: experienceLevel || undefined,
                skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
            });
            setUser(updated);
            toast.success('Profile updated successfully.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            toast.error('New password must be at least 8 characters.');
            return;
        }
        setChangingPw(true);
        try {
            await userService.changePassword(currentPassword, newPassword);
            toast.success('Password changed successfully.');
            await authService.logout().catch(() => undefined);
            logout();
            navigate('/login', { replace: true });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to change password.');
        } finally {
            setChangingPw(false);
        }
    };

    const handleDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (deleteConfirmation !== 'DELETE') {
            toast.error('Type DELETE to confirm permanent account deletion.');
            return;
        }
        setDeletingAccount(true);
        try {
            await userService.deleteAccount(deleteConfirmation, deletePassword || undefined);
            logout();
            navigate('/', { replace: true });
            toast.success('Your account and interview data were permanently deleted.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete account.');
        } finally {
            setDeletingAccount(false);
        }
    };

    // Dynamic config status handlers removed (Gemma URL is static)

    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse mb-6">
                <li>
                    <Link to="/dashboard" className="text-primary hover:underline font-bold">
                        Dashboard
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span className="text-white-dark">Settings</span>
                </li>
            </ul>

            <div className="pt-2">
                <div className="flex items-center justify-between mb-5">
                    <h5 className="font-semibold text-lg dark:text-white-light">Account Settings</h5>
                </div>
                <div>
                    <ul className="sm:flex font-semibold border-b border-[#ebedf2] dark:border-[#191e3a] mb-5 whitespace-nowrap overflow-y-auto">
                        <li className="inline-block">
                            <button
                                onClick={() => setTabs('profile')}
                                className={`flex gap-2 p-4 border-b border-transparent hover:border-primary hover:text-primary ${
                                    tabs === 'profile' ? '!border-primary text-primary' : ''
                                }`}
                            >
                                <User className="w-5 h-5" />
                                Profile Info
                            </button>
                        </li>
                        <li className="inline-block">
                            <button
                                onClick={() => setTabs('security')}
                                className={`flex gap-2 p-4 border-b border-transparent hover:border-primary hover:text-primary ${
                                    tabs === 'security' ? '!border-primary text-primary' : ''
                                }`}
                            >
                                <Lock className="w-5 h-5" />
                                Password & Security
                            </button>
                        </li>

                    </ul>
                </div>

                {tabs === 'profile' && (
                    <div className="panel bg-white dark:bg-black p-6 rounded-md">
                        <form onSubmit={handleSaveProfile}>
                            <h6 className="text-lg font-bold mb-5 dark:text-white-light">General Information</h6>
                            <div className="flex flex-col sm:flex-row">
                                <div className="ltr:sm:mr-8 rtl:sm:ml-8 w-full sm:w-2/12 mb-5 text-center flex flex-col items-center">
                                    <div className="relative group/avatar cursor-pointer w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mx-auto ring-4 ring-primary/15">
                                        <img
                                            src={user?.avatar || "/assets/images/user-profile.jpeg"}
                                            alt="avatar"
                                            className="w-full h-full object-cover"
                                        />
                                        <label
                                            htmlFor="avatar-upload"
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer duration-200"
                                        >
                                            <User className="w-5 h-5 mb-1" />
                                            Change Photo
                                        </label>
                                        <input
                                            id="avatar-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleAvatarChange}
                                            disabled={uploadingAvatar}
                                        />
                                    </div>
                                    {uploadingAvatar && <span className="text-[10px] text-primary font-bold mt-2 animate-pulse">Uploading...</span>}
                                </div>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                                    <div>
                                        <label htmlFor="name" className="font-bold dark:text-white-light">Full Name</label>
                                        <input
                                            id="name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="font-bold dark:text-white-light">Email Address</label>
                                        <input
                                            id="email"
                                            type="email"
                                            value={user?.email || ''}
                                            className="form-input bg-gray-100 dark:bg-black cursor-not-allowed"
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="targetRole" className="font-bold dark:text-white-light">Target Job Title</label>
                                        <input
                                            id="targetRole"
                                            type="text"
                                            value={targetRole}
                                            onChange={(e) => setTargetRole(e.target.value)}
                                            className="form-input"
                                            placeholder="e.g. Software Engineer"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="experienceLevel" className="font-bold dark:text-white-light">Experience Level</label>
                                        <select
                                            id="experienceLevel"
                                            value={experienceLevel}
                                            onChange={(e) => setExperienceLevel(e.target.value)}
                                            className="form-select text-white-dark"
                                        >
                                            <option value="">Select Level</option>
                                            <option value="entry">Entry Level</option>
                                            <option value="mid">Mid Level</option>
                                            <option value="senior">Senior Level</option>
                                            <option value="lead">Lead / Managerial</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="skills" className="font-bold dark:text-white-light">Key Skills (comma separated)</label>
                                        <input
                                            id="skills"
                                            type="text"
                                            value={skills}
                                            onChange={(e) => setSkills(e.target.value)}
                                            className="form-input"
                                            placeholder="React, Node.js, System Design"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="bio" className="font-bold dark:text-white-light">Professional Bio</label>
                                        <textarea
                                            id="bio"
                                            rows={4}
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            className="form-input resize-none"
                                            placeholder="Describe your background and career interests..."
                                        />
                                    </div>
                                    <div className="sm:col-span-2 mt-4">
                                        <button type="submit" disabled={saving} className="btn btn-primary">
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {tabs === 'security' && (
                    <div className="panel bg-white dark:bg-black p-6 rounded-md">
                        <form onSubmit={handleSavePassword}>
                            <h6 className="text-lg font-bold mb-5 dark:text-white-light">Change Security Credentials</h6>
                            <div className="max-w-xl space-y-4 text-sm">
                                <div>
                                    <label htmlFor="currentPassword font-bold dark:text-white-light">Current Password</label>
                                    <input
                                        id="currentPassword"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="newPassword font-bold dark:text-white-light">New Password</label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword font-bold dark:text-white-light">Confirm New Password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div className="pt-2">
                                    <button type="submit" disabled={changingPw} className="btn btn-primary">
                                        {changingPw ? 'Updating...' : 'Change Password'}
                                    </button>
                                </div>
                            </div>
                        </form>
                        <form onSubmit={handleDeleteAccount} className="mt-8 pt-6 border-t border-danger/20 max-w-xl">
                            <h6 className="text-lg font-bold text-danger mb-2">Delete Account</h6>
                            <p className="text-sm text-text-muted mb-4">
                                Permanently deletes your interviews, answers, reports, recordings, and profile. This cannot be undone.
                            </p>
                            <div className="space-y-4">
                                <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="form-input" placeholder="Type DELETE to confirm" />
                                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="form-input" placeholder="Current password (password accounts)" />
                                <button type="submit" disabled={deletingAccount || deleteConfirmation !== 'DELETE'} className="btn btn-danger">
                                    {deletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}


            </div>
        </div>
    );
};

export default SettingsPage;
