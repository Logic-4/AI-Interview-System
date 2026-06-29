import PerfectScrollbar from 'react-perfect-scrollbar';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { IRootState } from '../../store';
import { useEffect } from 'react';
import {
    LayoutDashboard,
    PlusCircle,
    History,
    BarChart3,
    HelpCircle,
    GraduationCap,
    Award,
    Trophy,
    ChevronDown
} from 'lucide-react';

const Sidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const location = useLocation();
    const dispatch = useDispatch();
    const { t } = useTranslation();

    useEffect(() => {
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
    }, [location]);

    const navItems = [
        { path: '/dashboard', label: t('Dashboard'), icon: LayoutDashboard, end: true },
        { path: '/interviews/new', label: t('New Interview'), icon: PlusCircle, end: true },
        { path: '/interviews', label: t('History'), icon: History, end: true },
        { path: '/analytics', label: t('Analytics'), icon: BarChart3, end: false },
        { path: '/questions', label: t('Questions Library'), icon: HelpCircle, end: false },
        { path: '/study-plan', label: t('Study Plan'), icon: GraduationCap, end: false },
        { path: '/achievements', label: t('Achievements'), icon: Award, end: true },
        { path: '/leaderboard', label: t('Leaderboard'), icon: Trophy, end: true },
    ];

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] z-50 transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="bg-white dark:bg-black h-full">
                    <div className="flex justify-between items-center px-4 py-3">
                        <NavLink to="/" className="main-logo flex items-center shrink-0">
                            <img className="w-8 ml-[5px] flex-none object-contain" src="/ai-interview-logo.svg" alt="logo" />
                            <span className="text-2xl ltr:ml-1.5 rtl:mr-1.5 font-semibold align-middle lg:inline dark:text-white-light">
                                InterviewAI
                            </span>
                        </NavLink>

                        <button
                            type="button"
                            className="collapse-icon w-8 h-8 rounded-full flex items-center hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light transition duration-300 rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <ChevronDown className="m-auto rotate-90" />
                        </button>
                    </div>
                    <PerfectScrollbar className="h-[calc(100vh-80px)] relative">
                        <ul className="relative font-semibold space-y-2 p-4 py-0">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <li className="menu nav-item mb-0" key={item.path}>
                                        <NavLink
                                            to={item.path}
                                            end={item.end}
                                            className={({ isActive }) =>
                                                `flex items-center !justify-start h-12 px-4 rounded-xl font-bold text-sm transition-all duration-150 group ${
                                                    isActive
                                                        ? '!bg-primary-light text-primary dark:!bg-primary-dark-light'
                                                        : 'text-[#697386] dark:text-[#888ea8] hover:text-[#1E2433] dark:hover:text-white-light hover:bg-[#F7F8FC] dark:hover:bg-[#1b2e4b]'
                                                }`
                                            }
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <Icon
                                                        className={`w-[20px] h-[20px] shrink-0 transition-all duration-150 group-hover:scale-110 ${
                                                            isActive ? 'text-primary' : 'text-[#888ea8] dark:text-[#506690] group-hover:text-primary'
                                                        }`}
                                                    />
                                                    <span className={`ltr:pl-3.5 rtl:pr-3.5 inline-block transition-transform duration-150 ease-out group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5 ${isActive ? 'text-primary' : ''}`}>
                                                        {item.label}
                                                    </span>
                                                </>
                                            )}
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
