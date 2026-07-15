import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { useEffect, useState, useMemo } from 'react';
import { setPageTitle } from '../../store/themeConfigSlice';
import { Mail, Lock, Eye, EyeOff, UserRound, X } from 'lucide-react';
import authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';
import { sanitizeRedirectPath } from '../../lib/authRedirect';
import { getGoogleAuthUrl } from '../../lib/apiConfig';
import toast from 'react-hot-toast';
import axios from 'axios';
import ThemeToggle from '../../components/layout/ThemeToggle';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { forgetGoogleAccount, getRememberedGoogleAccounts, RememberedGoogleAccount } from '../../lib/rememberedAccounts';

const LoginPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const login = useAuthStore((s) => s.login);
    const setUser = useAuthStore((s) => s.setUser);
    const logout = useAuthStore((s) => s.logout);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberedAccounts, setRememberedAccounts] = useState<RememberedGoogleAccount[]>([]);

    const redirectPath = useMemo(
        () => sanitizeRedirectPath(searchParams.get('from')),
        [searchParams]
    );

    useEffect(() => {
        dispatch(setPageTitle('Sign In | InterviewAI'));
        setRememberedAccounts(getRememberedGoogleAccounts());
    }, [dispatch]);

    useEffect(() => {
        let active = true;

        const syncSession = async () => {
            try {
                const storedToken = localStorage.getItem('accessToken');
                if (!storedToken) {
                    logout();
                    return;
                }

                const user = await authService.getMe();
                if (!active) return;

                setUser(user);
                navigate(redirectPath, { replace: true });
            } catch {
                if (!active) return;
                logout();
            } finally {
                if (active) setIsCheckingSession(false);
            }
        };

        syncSession();

        return () => {
            active = false;
        };
    }, [logout, redirectPath, navigate, setUser]);

    useEffect(() => {
        const errorMsg = searchParams.get('error');
        if (errorMsg) {
            toast.error(errorMsg);
            const cleaned = new URLSearchParams(searchParams.toString());
            cleaned.delete('error');
            setSearchParams(cleaned, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(false);
        setIsLoading(true);
        try {
            const { user, accessToken } = await authService.login({ email, password, rememberMe });
            login(user, accessToken, rememberMe);
            navigate(redirectPath, { replace: true });
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Invalid email or password. Please try again.';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const continueWithGoogle = (email?: string) => {
        window.location.href = getGoogleAuthUrl(email);
    };

    const forgetAccount = (email: string) => {
        forgetGoogleAccount(email);
        setRememberedAccounts(getRememberedGoogleAccounts());
    };

    return (
        <div>
            <div className="absolute inset-0">
                <img src="/assets/images/auth/bg-gradient.png" alt="image" className="h-full w-full object-cover" />
            </div>

            <div className="relative flex h-screen items-center justify-center bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-4 dark:bg-[#060818] sm:px-16 overflow-hidden">
                <div className="absolute right-6 top-6 md:top-1/2 md:-translate-y-1/2 z-50">
                    <ThemeToggle />
                </div>
                <img src="/assets/images/auth/coming-soon-object1.png" alt="image" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <img src="/assets/images/auth/coming-soon-object2.png" alt="image" className="absolute left-24 top-0 h-40 md:left-[30%]" />
                <img src="/assets/images/auth/coming-soon-object3.png" alt="image" className="absolute right-0 top-0 h-[300px]" />
                <img src="/assets/images/auth/polygon-object.svg" alt="image" className="absolute bottom-0 end-[28%]" />
                <div className="relative w-full max-w-[530px] rounded-md bg-[linear-gradient(45deg,#fff9f9_0%,rgba(255,255,255,0)_25%,rgba(255,255,255,0)_75%,_#fff9f9_100%)] p-2 dark:bg-[linear-gradient(52.22deg,#0E1726_0%,rgba(14,23,38,0)_18.66%,rgba(14,23,38,0)_51.04%,rgba(14,23,38,0)_80.07%,#0E1726_100%)]">
                    <div className="relative flex flex-col justify-center rounded-md bg-white/60 backdrop-blur-lg dark:bg-black/50 px-6 py-6 md:py-8">
                        <div className="mx-auto w-full max-w-[440px]">
                            <div className="mb-6 flex flex-col items-center text-center">
                                <img className="h-24 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Sign in</h1>
                                <p className="text-base font-bold leading-normal text-white-dark mt-2">Enter your email and password to login</p>
                            </div>
                            {rememberedAccounts.length > 0 && (
                                <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                                        <UserRound className="h-4 w-4" /> Continue as
                                    </div>
                                    <div className="space-y-2">
                                        {rememberedAccounts.map((account) => (
                                            <div key={account.email} className="flex items-center gap-3 rounded-xl bg-white/80 p-3 dark:bg-black/30">
                                                {account.avatar ? (
                                                    <img src={account.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{account.name?.charAt(0)?.toUpperCase() || 'G'}</div>
                                                )}
                                                <button type="button" onClick={() => continueWithGoogle(account.email)} className="min-w-0 flex-1 text-left">
                                                    <span className="block truncate text-sm font-bold text-text-primary dark:text-white">{account.name || 'Google account'}</span>
                                                    <span className="block truncate text-xs text-text-muted">{account.email}</span>
                                                </button>
                                                <button type="button" onClick={() => forgetAccount(account.email)} aria-label={`Forget ${account.email}`} className="rounded p-1 text-text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <form className="space-y-5 dark:text-white" onSubmit={handleSubmit}>
                                <div>
                                    <label htmlFor="Email">Email Address</label>
                                    <div className="flex items-center gap-3 text-white-dark">
                                        <Mail className="w-5 h-5 shrink-0" />
                                        <input
                                            id="Email"
                                            type="email"
                                            placeholder="name@company.com"
                                            className="form-input w-full placeholder:text-white-dark"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="Password">Password</label>
                                        <Link to="/forgot-password" className="text-xs text-primary hover:underline font-bold mb-1">
                                            Forgot Password?
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-3 text-white-dark">
                                        <Lock className="w-5 h-5 shrink-0" />
                                        <div className="relative flex-1">
                                            <input
                                                id="Password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="form-input w-full pr-10 placeholder:text-white-dark"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white-light"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            className="form-checkbox bg-white dark:bg-black border-gray-200 dark:border-white-light/10"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        <span className="text-white-dark">Remember me</span>
                                    </label>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || isCheckingSession}
                                    className="btn btn-primary !mt-6 w-full h-12 py-0 border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)]"
                                >
                                    {isLoading || isCheckingSession ? (
                                        <>
                                            <LoadingSpinner size="sm" className="mr-2 inline-block text-white" />
                                            {isCheckingSession ? 'Checking...' : 'Signing in...'}
                                        </>
                                    ) : (
                                        'Sign in'
                                    )}
                                </button>
                            </form>
                            <div className="mt-4 mb-4 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => continueWithGoogle()}
                                    className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-primary text-primary hover:bg-primary-light dark:hover:bg-primary-dark-light hover:text-primary-hover font-bold transition-all duration-150 active:scale-95 cursor-pointer"
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span>Continue with Google</span>
                                </button>
                            </div>
                            <div className="text-center dark:text-white font-bold text-sm">
                                Don't have an account ?&nbsp;
                                <Link to="/register" className="uppercase text-primary underline transition hover:text-black dark:hover:text-white">
                                    Create an account
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
