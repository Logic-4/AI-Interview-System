import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Building2, KeyRound, Globe, Phone, MapPin, Mail, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CompanyProfile } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const CompanySettingsPage = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState<Partial<CompanyProfile>>({
    name: '',
    contactEmail: '',
    logo: '',
    phone: '',
    website: '',
    address: '',
    description: '',
    preferredLanguage: 'English',
    timezone: 'UTC',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    dispatch(setPageTitle('Company Settings | RecruitAI'));
    const load = async () => {
      try {
        const comp = await companyService.getCompanySettings();
        setProfile(comp);
      } catch (err: any) {
        toast.error('Failed to load company profile');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [dispatch]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await companyService.updateCompanyProfile(profile);
      toast.success('Company profile updated successfully!');
    } catch (err: any) {
      toast.error('Failed to update company profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await companyService.updateAccountSettings(currentPassword, newPassword);
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Company Settings</h1>
        <p className="mt-1 text-sm text-white-dark">Manage organization details, contact information, and security preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white-light dark:border-white-light/10">
        <button
          type="button"
          className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold text-sm transition-all ${
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-white-dark hover:text-black dark:hover:text-white'
          }`}
          onClick={() => setActiveTab('profile')}
        >
          <Building2 className="h-4 w-4" /> Company Information
        </button>

        <button
          type="button"
          className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold text-sm transition-all ${
            activeTab === 'account'
              ? 'border-primary text-primary'
              : 'border-transparent text-white-dark hover:text-black dark:hover:text-white'
          }`}
          onClick={() => setActiveTab('account')}
        >
          <KeyRound className="h-4 w-4" /> Account Settings
        </button>
      </div>

      {/* TAB 1: Company Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="panel space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="companyName">Company Name *</label>
              <input
                id="companyName"
                className="form-input"
                value={profile.name || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label htmlFor="contactEmail">Contact Email *</label>
              <input
                id="contactEmail"
                type="email"
                className="form-input"
                value={profile.contactEmail || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
                required
              />
            </div>

            <div>
              <label htmlFor="companyLogo">Company Logo URL</label>
              <input
                id="companyLogo"
                className="form-input"
                placeholder="https://company.com/logo.png"
                value={profile.logo || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, logo: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                className="form-input"
                placeholder="+252 61 XXX XXXX"
                value={profile.phone || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                className="form-input"
                placeholder="https://company.com"
                value={profile.website || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, website: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="address">Address</label>
              <input
                id="address"
                className="form-input"
                placeholder="Mogadishu, Somalia"
                value={profile.address || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description">Company Description</label>
              <textarea
                id="description"
                rows={4}
                className="form-textarea"
                placeholder="Overview of company background, culture, and mission..."
                value={profile.description || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              <Save className="mr-2 h-4 w-4" />
              {savingProfile ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Account Settings */}
      {activeTab === 'account' && (
        <div className="panel space-y-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-2">
              Change Password
            </h3>

            <div>
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn btn-warning" disabled={savingPassword}>
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* Preferences */}
          <div className="space-y-4 pt-4 border-t border-white-light dark:border-white-light/10">
            <h3 className="text-lg font-bold text-black dark:text-white">Regional Preferences</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="preferredLanguage">Preferred Language</label>
                <select
                  id="preferredLanguage"
                  className="form-select"
                  value={profile.preferredLanguage || 'English'}
                  onChange={(e) => setProfile((prev) => ({ ...prev, preferredLanguage: e.target.value }))}
                >
                  <option value="English">English</option>
                  <option value="Somali">Somali</option>
                </select>
              </div>

              <div>
                <label htmlFor="timezone">Time Zone</label>
                <select
                  id="timezone"
                  className="form-select"
                  value={profile.timezone || 'UTC'}
                  onChange={(e) => setProfile((prev) => ({ ...prev, timezone: e.target.value }))}
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Africa/Mogadishu">EAT (East Africa Time - UTC+3)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettingsPage;
