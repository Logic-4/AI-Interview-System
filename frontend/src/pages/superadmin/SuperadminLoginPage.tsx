import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { setPageTitle } from '@/store/themeConfigSlice';
import { useAuthStore } from '@/stores/authStore';
import superadminService from '@/services/superadminService';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const SuperadminLoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { dispatch(setPageTitle('Superadmin Sign In | InterviewAI')); }, [dispatch]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await superadminService.login(email, password, rememberMe);
      login(result.user, result.accessToken, rememberMe);
      navigate('/superadmin/dashboard', { replace: true });
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || 'Unable to sign in.' : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="absolute inset-0"><img src="/assets/images/auth/bg-gradient.png" alt="" className="h-full w-full object-cover" /></div>
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-4 dark:bg-[#060818] sm:px-16">
        <div className="absolute right-6 top-6 z-50 md:top-1/2 md:-translate-y-1/2"><ThemeToggle /></div>
        <img src="/assets/images/auth/coming-soon-object1.png" alt="" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
        <img src="/assets/images/auth/coming-soon-object2.png" alt="" className="absolute left-24 top-0 h-40 md:left-[30%]" />
        <img src="/assets/images/auth/coming-soon-object3.png" alt="" className="absolute right-0 top-0 h-[300px]" />
        <img src="/assets/images/auth/polygon-object.svg" alt="" className="absolute bottom-0 end-[28%]" />

        <div className="relative w-full max-w-[530px] rounded-md bg-[linear-gradient(45deg,#fff9f9_0%,rgba(255,255,255,0)_25%,rgba(255,255,255,0)_75%,_#fff9f9_100%)] p-2 dark:bg-[linear-gradient(52.22deg,#0E1726_0%,rgba(14,23,38,0)_18.66%,rgba(14,23,38,0)_51.04%,rgba(14,23,38,0)_80.07%,#0E1726_100%)]">
          <div className="relative flex flex-col justify-center rounded-md bg-white/60 px-6 py-6 backdrop-blur-lg dark:bg-black/50 md:py-8">
            <div className="mx-auto w-full max-w-[440px]">
              <div className="mb-6 flex flex-col items-center text-center">
                <img className="mb-4 h-20 object-contain" src="/ai-interview-logo.svg" alt="InterviewAI" />
                <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary">Sign in</h1>
                <p className="mt-2 text-sm font-bold leading-normal text-white-dark">Superadmin portal</p>
              </div>
              <form className="space-y-5 dark:text-white" onSubmit={submit}>
                <div><label htmlFor="superadmin-email">Email Address</label><div className="flex items-center gap-3 text-white-dark"><Mail className="h-5 w-5 shrink-0" /><input id="superadmin-email" type="email" placeholder="admin@company.com" className="form-input w-full placeholder:text-white-dark" value={email} onChange={(event) => setEmail(event.target.value.replace(/\s/g, ''))} required /></div></div>
                <div><label htmlFor="superadmin-password">Password</label><div className="flex items-center gap-3 text-white-dark"><Lock className="h-5 w-5 shrink-0" /><div className="relative flex-1"><input id="superadmin-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="form-input w-full pr-10 placeholder:text-white-dark" value={password} onChange={(event) => setPassword(event.target.value.replace(/\s/g, ''))} required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white-light">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div></div>
                <label className="flex cursor-pointer items-center"><input type="checkbox" className="form-checkbox bg-white dark:bg-black border-gray-200 dark:border-white-light/10" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span className="text-white-dark">Remember me</span></label>
                <button type="submit" disabled={loading} className="btn btn-primary !mt-6 h-12 w-full border-0 py-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)]">{loading ? <><LoadingSpinner size="sm" className="mr-2 inline-block text-white" /> Signing in...</> : 'Sign in'}</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminLoginPage;
