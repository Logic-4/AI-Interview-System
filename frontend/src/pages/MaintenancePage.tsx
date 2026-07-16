import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function MaintenancePage() {
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    useEffect(() => {
        document.title = 'System Maintenance | InterviewAI';
    }, []);

    const checkSystemStatus = async () => {
        setIsChecking(true);
        const toastId = toast.loading('Checking system status...');
        try {
            // Fetch dynamically via client API URL
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const response = await axios.get(`${apiUrl}/health`);
            
            if (response.data && response.data.success) {
                const isUnderMaintenance = response.data.maintenance;
                
                if (!isUnderMaintenance) {
                    toast.success('System is back online! Redirecting...', { id: toastId });
                    setIsOnline(true);
                    
                    const hasToken = localStorage.getItem('accessToken');
                    setTimeout(() => {
                        navigate(hasToken ? '/dashboard' : '/login', { replace: true });
                    }, 1500);
                } else {
                    toast.error('The system is still undergoing maintenance.', { id: toastId });
                    setIsOnline(false);
                }
            } else {
                toast.error('Unable to verify system status. Please try again.', { id: toastId });
            }
        } catch (error) {
            toast.error('The server is currently unreachable. Still in maintenance.', { id: toastId });
            setIsOnline(false);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-[#060818] overflow-hidden text-white font-nunito">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />

            <div className="relative w-full max-w-xl mx-4 p-8 md:p-12 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
                {/* Status Indicator Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-8">
                    <AlertCircle className="w-4 h-4 animate-pulse" />
                    Maintenance Mode Active
                </div>

                {/* Animated Character / Image */}
                <div className="relative w-64 h-64 mb-8 group">
                    <div className="absolute inset-4 rounded-full bg-orange-500/10 blur-xl group-hover:bg-orange-500/20 transition-all duration-500" />
                    <img 
                        src="/assets/images/maintenance.png" 
                        alt="Maintenance Robot" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(249,115,22,0.2)] transform hover:scale-105 transition-transform duration-500"
                    />
                </div>

                {/* Content */}
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-4">
                    We'll Be Right Back!
                </h1>
                
                <p className="text-slate-400 text-base leading-relaxed mb-10 max-w-md">
                    Our servers are currently undergoing scheduled maintenance and system optimization. We are working hard to enhance your interview experience.
                </p>

                {/* Controls */}
                <div className="w-full flex flex-col gap-4 sm:flex-row justify-center items-center">
                    <button
                        onClick={checkSystemStatus}
                        disabled={isChecking}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                        <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
                        {isChecking ? 'Checking Status...' : 'Check System Status'}
                    </button>
                </div>

                {/* Connection Status Indicator */}
                {isOnline === false && (
                    <p className="mt-6 text-xs text-rose-400/80 flex items-center gap-1.5 animate-fade-in">
                        <Wrench className="w-3.5 h-3.5" /> Maintenance is still active. Please check back in a few minutes.
                    </p>
                )}
            </div>
        </div>
    );
}
