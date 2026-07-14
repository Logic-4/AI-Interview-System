import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { setPageTitle } from '../../store/themeConfigSlice';
import { useAuthStore } from '../../stores/authStore';
import userService from '../../services/userService';
import type { DashboardStats } from '../../types/user';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

import { PenSquare, Coffee, Calendar, Mail, TrendingUp, Star, Folder } from 'lucide-react';

const ProfilePage = () => {
    const dispatch = useDispatch();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dispatch(setPageTitle('Profile | InterviewAI'));
        userService
            .getDashboard()
            .then(setStats)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [dispatch]);

    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse mb-6">
                <li>
                    <Link to="/dashboard" className="text-primary hover:underline font-bold">
                        Dashboard
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span className="text-white-dark">Profile</span>
                </li>
            </ul>

            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Left Profile Panel */}
                <div className="panel">
                    <div className="flex items-center justify-between mb-5">
                        <h5 className="font-semibold text-lg dark:text-white-light">Profile</h5>
                        <Link to="/settings" className="btn btn-primary p-2 rounded-full">
                            <PenSquare className="w-5 h-5" />
                        </Link>
                    </div>
                    <div className="mb-5">
                        <div className="flex flex-col justify-center items-center">
                            <img src={user?.avatar || "/assets/images/user-profile.jpeg"} alt="img" className="w-24 h-24 rounded-full object-cover mb-5 ring-4 ring-primary/20" />
                            <p className="font-semibold text-primary text-xl">{user?.name ?? 'User'}</p>
                        </div>
                        <ul className="mt-6 flex flex-col max-w-[200px] m-auto space-y-4 font-semibold text-white-dark text-sm">
                            {user?.targetRole && (
                                <li className="flex items-center gap-2">
                                    <Coffee className="shrink-0 w-4.5 h-4.5 text-primary" />
                                    <span className="truncate">{user.targetRole}</span>
                                </li>
                            )}
                            {user?.experienceLevel && (
                                <li className="flex items-center gap-2 capitalize">
                                    <TrendingUp className="shrink-0 w-4.5 h-4.5 text-primary" />
                                    <span>{user.experienceLevel} Level</span>
                                </li>
                            )}
                            <li className="flex items-center gap-2">
                                <Calendar className="shrink-0 w-4.5 h-4.5 text-primary" />
                                <span>Joined {memberSince}</span>
                            </li>
                            <li className="flex items-center gap-2 truncate">
                                <Mail className="shrink-0 w-4.5 h-4.5 text-primary" />
                                <span className="truncate">{user?.email}</span>
                            </li>
                        </ul>
                    </div>
                    {user?.bio && (
                        <div className="border-t border-white-light dark:border-white-light/10 pt-4 text-center">
                            <h6 className="font-bold text-xs uppercase tracking-widest text-white-dark mb-2">About Me</h6>
                            <p className="text-xs text-white-dark leading-relaxed font-semibold italic">{user.bio}</p>
                        </div>
                    )}
                </div>

                {/* Right Statistics Panels */}
                <div className="panel lg:col-span-2 xl:col-span-3">
                    <div className="mb-5">
                        <h5 className="font-semibold text-lg dark:text-white-light">Performance Summary</h5>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="border border-white-light dark:border-white-light/10 rounded-lg p-4 text-center bg-gray-50 dark:bg-black/10">
                            <Folder className="w-6 h-6 text-primary mx-auto mb-2" />
                            <div className="text-xl font-bold dark:text-white">{stats?.overview.totalInterviews ?? 0}</div>
                            <span className="text-[10px] text-white-dark uppercase tracking-widest font-extrabold mt-1 block">Interviews</span>
                        </div>
                        <div className="border border-white-light dark:border-white-light/10 rounded-lg p-4 text-center bg-gray-50 dark:bg-black/10">
                            <Folder className="w-6 h-6 text-success mx-auto mb-2" />
                            <div className="text-xl font-bold dark:text-white">{stats?.overview.completedInterviews ?? 0}</div>
                            <span className="text-[10px] text-white-dark uppercase tracking-widest font-extrabold mt-1 block">Completed</span>
                        </div>
                        <div className="border border-white-light dark:border-white-light/10 rounded-lg p-4 text-center bg-gray-50 dark:bg-black/10">
                            <Star className="w-6 h-6 text-warning mx-auto mb-2" />
                            <div className="text-xl font-bold dark:text-white">{stats?.scores.average ?? 0}%</div>
                            <span className="text-[10px] text-white-dark uppercase tracking-widest font-extrabold mt-1 block">Average</span>
                        </div>
                        <div className="border border-white-light dark:border-white-light/10 rounded-lg p-4 text-center bg-gray-50 dark:bg-black/10">
                            <Star className="w-6 h-6 text-info mx-auto mb-2" />
                            <div className="text-xl font-bold dark:text-white">{stats?.scores.highest ?? 0}%</div>
                            <span className="text-[10px] text-white-dark uppercase tracking-widest font-extrabold mt-1 block">Best Score</span>
                        </div>
                    </div>

                    <div className="mb-5">
                        <h5 className="font-semibold text-base dark:text-white-light mb-3">Recent Practice Logs</h5>
                        {!stats?.recentInterviews?.length ? (
                            <div className="py-6 text-center text-white-dark font-semibold">
                                No sessions recorded yet. Build up your history by starting a new interview.
                            </div>
                        ) : (
                            <div className="table-responsive text-[#515365] dark:text-white-light font-semibold">
                                <table className="whitespace-nowrap table-hover">
                                    <thead>
                                        <tr>
                                            <th>Role Title</th>
                                            <th>Status</th>
                                            <th>Overall Rating</th>
                                            <th>Session Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="dark:text-white-dark">
                                        {stats.recentInterviews.map((iv) => (
                                            <tr key={iv._id}>
                                                <td className="font-bold text-primary">{iv.title}</td>
                                                <td>
                                                    <span className={`badge ${iv.status === 'completed' ? 'badge-outline-success' : 'badge-outline-primary'}`}>
                                                        {iv.status}
                                                    </span>
                                                </td>
                                                <td className="font-extrabold">{iv.overallScore ? `${iv.overallScore}%` : 'Pending'}</td>
                                                <td className="text-white-dark">
                                                    {new Date(iv.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
