import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { setPageTitle } from '../../store/themeConfigSlice';
import { Lock, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import ThemeToggle from '../../components/layout/ThemeToggle';

const ResetPasswordPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const params = useParams();
    const token = params?.token as string;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        dispatch(setPageTitle('Set New Password | InterviewAI'));
    }, [dispatch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }
        setIsLoading(true);
        try {
            await api.post(`/auth/reset-password/${token}`, { password });
            setDone(true);
            toast.success('Your password has been successfully reset.');
            setTimeout(() => navigate('/login', { replace: true }), 3000);
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Reset failed. The recovery link may have expired.';
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
                             {done ? (
                                <div className="text-center flex flex-col items-center">
                                    <img className="w-12 h-12 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                    <div className="mb-6">
                                        <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Success</h1>
                                        <p className="text-base font-bold leading-normal text-white-dark mt-2">
                                            Password updated. Redirecting to login portal...
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-6 flex flex-col items-center text-center">
                                        <img className="w-12 h-12 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                        <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Set New Password</h1>
                                        <p className="text-base font-bold leading-normal text-white-dark mt-2">Enter and confirm your new password below</p>
                                    </div>
                                    <form className="space-y-5 dark:text-white" onSubmit={handleSubmit}>
                                        <div>
                                            <label htmlFor="Password">New Password</label>
                                            <div className="flex items-center gap-3 text-white-dark">
                                                <Lock className="w-5 h-5 shrink-0" />
                                                <div className="relative flex-1">
                                                    <input
                                                        id="Password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        className="form-input w-full pr-10 placeholder:text-white-dark"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
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
                                            <label htmlFor="ConfirmPassword">Confirm Password</label>
                                            <div className="flex items-center gap-3 text-white-dark">
                                                <Lock className="w-5 h-5 shrink-0" />
                                                <div className="relative flex-1">
                                                    <input
                                                        id="ConfirmPassword"
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        className="form-input w-full pr-10 placeholder:text-white-dark"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white-light"
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="btn btn-primary !mt-6 w-full h-12 py-0 border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)]"
                                        >
                                            {isLoading ? 'Processing...' : 'RESET PASSWORD'}
                                        </button>
                                    </form>
                                    <div className="text-center dark:text-white font-bold mt-8">
                                        <Link to="/login" className="uppercase text-primary underline transition hover:text-black dark:hover:text-white">
                                            Back to Sign In
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
