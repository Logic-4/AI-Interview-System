import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { setPageTitle } from '../../store/themeConfigSlice';
import { Mail } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import ThemeToggle from '../../components/layout/ThemeToggle';

const ForgotPasswordPage = () => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(setPageTitle('Reset Password | InterviewAI'));
    }, [dispatch]);

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
            toast.success('Recovery link sent to your email.');
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Something went wrong. Please try again.';
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
                             {sent ? (
                                <div className="text-center flex flex-col items-center">
                                    <img className="w-12 h-12 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                    <div className="mb-6">
                                        <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Check Inbox</h1>
                                        <p className="text-base font-bold leading-normal text-white-dark mt-2">
                                            A recovery link has been sent to <span className="text-primary font-black">{email}</span>.
                                        </p>
                                    </div>
                                    <Link to="/login" className="btn btn-primary uppercase w-full h-12 py-0">
                                        Back to Sign In
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-6 flex flex-col items-center text-center">
                                        <img className="w-12 h-12 mb-4 object-contain" src="/ai-interview-logo.svg" alt="logo" />
                                        <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Password Recovery</h1>
                                        <p className="text-base font-bold leading-normal text-white-dark mt-2">Enter your email to receive a recovery link</p>
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
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="btn btn-primary !mt-6 w-full h-12 py-0 border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)]"
                                        >
                                            {isLoading ? 'Processing...' : 'RECOVER'}
                                        </button>
                                    </form>
                                    <div className="text-center dark:text-white font-bold mt-8">
                                        Remembered password?&nbsp;
                                        <Link to="/login" className="uppercase text-primary underline transition hover:text-black dark:hover:text-white">
                                            Sign In
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

export default ForgotPasswordPage;
