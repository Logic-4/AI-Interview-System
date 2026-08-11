import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { useEffect, useState, useMemo } from 'react';
import { setPageTitle } from '../../store/themeConfigSlice';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';
import { sanitizeRedirectPath } from '../../lib/authRedirect';
import toast from 'react-hot-toast';
import axios from 'axios';
import ThemeToggle from '../../components/layout/ThemeToggle';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

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

    const redirectPath = useMemo(
        () => sanitizeRedirectPath(searchParams.get('from')),
        [searchParams]
    );

    useEffect(() => {
        dispatch(setPageTitle('Sign In | InterviewAI'));
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
                const targetPath = sanitizeRedirectPath(searchParams.get('from'), user);
                navigate(targetPath, { replace: true });
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
    }, [logout, searchParams, navigate, setUser]);

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
            const targetPath = sanitizeRedirectPath(searchParams.get('from'), user);
            navigate(targetPath, { replace: true });
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

    return (
        <div>
            <div className="absolute inset-0">
                <img src="/assets/images/auth/bg-gradient.png" alt="image" className="h-full w-full object-cover" />
            </div>

            <div className="relative flex h-screen items-center justify-center bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-4 dark:bg-[#060818] sm:px-16 overflow-hidden">
                <img src="/assets/images/auth/coming-soon-object1.png" alt="image" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <img src="/assets/images/auth/coming-soon-object2.png" alt="image" className="absolute left-24 top-0 h-40 md:left-[30%]" />
                <img src="/assets/images/auth/coming-soon-object3.png" alt="image" className="absolute right-0 top-0 h-[300px]" />
                <img src="/assets/images/auth/polygon-object.svg" alt="image" className="absolute bottom-0 end-[28%]" />
                <div className="relative w-full max-w-[530px] rounded-md bg-[linear-gradient(45deg,#fff9f9_0%,rgba(255,255,255,0)_25%,rgba(255,255,255,0)_75%,_#fff9f9_100%)] p-2 dark:bg-[linear-gradient(52.22deg,#0E1726_0%,rgba(14,23,38,0)_18.66%,rgba(14,23,38,0)_51.04%,rgba(14,23,38,0)_80.07%,#0E1726_100%)]">
                    <div className="relative flex flex-col justify-center rounded-md bg-white/60 backdrop-blur-lg dark:bg-black/50 px-6 py-6 md:py-8">
                        <div className="absolute right-4 top-4 z-10">
                            <ThemeToggle />
                        </div>
                        <div className="mx-auto w-full max-w-[440px]">
                            <div className="mb-6 flex flex-col items-center text-center">
                                <img className="h-24 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Sign in</h1>
                                <p className="text-base font-bold leading-normal text-white-dark mt-2">Enter your email and password to login</p>
                            </div>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
