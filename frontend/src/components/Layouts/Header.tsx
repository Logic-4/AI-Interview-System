import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IRootState } from '../../store';
import { toggleRTL, toggleTheme, toggleSidebar } from '../../store/themeConfigSlice';
import { useTranslation } from 'react-i18next';
import Dropdown from '../Dropdown';
import { Menu, Search, XCircle, Sun, Moon, Monitor, User, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/authService';

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const getAvatarFallback = (name?: string) => {
        if (!name) return '👤';
        const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        return initials;
    };

    useEffect(() => {
        const selector = document.querySelector('ul.horizontal-menu a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const all: any = document.querySelectorAll('ul.horizontal-menu .nav-link.active');
            for (let i = 0; i < all.length; i++) {
                all[0]?.classList.remove('active');
            }
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                let ele: any = ul.closest('li.menu').querySelectorAll('.nav-link');
                if (ele) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele?.classList.add('active');
                    });
                }
            }
        }
    }, [location]);

    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass) === 'rtl' ? true : false;
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const handleLogout = async () => {
        try {
            await authService.logout();
        } finally {
            logout();
            navigate(user?.role === 'superadmin' ? '/superadmin/login' : '/login');
        }
    };

    return (
        <header className={`z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}>
            <div className="border-b border-[#E8ECF2] dark:border-white-light/10">
                <div className="relative bg-white dark:bg-[#0e1726] flex w-full items-center px-5 h-[72px]">
                    <div className="horizontal-logo flex lg:hidden justify-between items-center ltr:mr-2 rtl:ml-2">
                        <Link to="/" className="main-logo flex items-center shrink-0">
                            <img className="w-8 ltr:-ml-1 rtl:-mr-1 inline object-contain" src="/ai-interview-logo.svg" alt="logo" />
                            <span className="text-2xl ltr:ml-1.5 rtl:mr-1.5  font-semibold  align-middle hidden md:inline dark:text-white-light transition-all duration-300">
                                InterviewAI
                            </span>
                        </Link>
                        <button
                            type="button"
                            className="collapse-icon flex-none dark:text-[#d0d2d6] hover:text-primary dark:hover:text-primary flex lg:hidden ltr:ml-2 rtl:mr-2 p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60"
                            onClick={() => {
                                dispatch(toggleSidebar());
                            }}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="ltr:mr-2 rtl:ml-2 hidden sm:block">
                        <ul className="flex items-center space-x-2 rtl:space-x-reverse dark:text-[#d0d2d6]">
                        </ul>
                    </div>
                    <div className="sm:flex-1 ltr:sm:ml-0 ltr:ml-auto sm:rtl:mr-0 rtl:mr-auto flex items-center space-x-1.5 lg:space-x-2 rtl:space-x-reverse dark:text-[#d0d2d6]">
                        <div className="sm:ltr:mr-auto sm:rtl:ml-auto">
                        </div>
                        
                        <div>
                            {themeConfig.theme === 'light' ? (
                                <button
                                    className={`${
                                        themeConfig.theme === 'light' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('dark'));
                                    }}
                                >
                                    <Sun className="w-5 h-5" />
                                </button>
                            ) : (
                                ''
                            )}
                            {themeConfig.theme === 'dark' && (
                                <button
                                    className={`${
                                        themeConfig.theme === 'dark' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('system'));
                                    }}
                                >
                                    <Moon className="w-5 h-5" />
                                </button>
                            )}
                            {themeConfig.theme === 'system' && (
                                <button
                                    className={`${
                                        themeConfig.theme === 'system' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('light'));
                                    }}
                                >
                                    <Monitor className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <div className="dropdown shrink-0 flex">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName="relative group block"
                                button={
                                    <div className="flex items-center gap-2.5">
                                        <span className="hidden sm:block font-bold text-sm text-[#1E2433] dark:text-white-dark group-hover:text-primary transition-colors">
                                            {user ? user.name : 'Guest User'}
                                        </span>
                                        {user?.avatar ? (
                                            <img
                                                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20"
                                                src={user.avatar}
                                                alt="userProfile"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <div className={`w-9 h-9 rounded-full ring-2 ring-primary/20 flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary dark:from-primary/30 dark:to-primary/20 ${user?.avatar ? 'hidden' : ''}`}>
                                            {getAvatarFallback(user?.name)}
                                        </div>
                                    </div>
                                }
                            >
                                <ul className="text-dark dark:text-white-dark !py-0 w-[280px] font-semibold dark:text-white-light/90 border border-[#E8ECF2] dark:border-[#1b2e4b] shadow-lg rounded-xl overflow-hidden bg-white dark:bg-[#0e1726]">
                                    <li>
                                        <div className="flex items-center gap-3 px-4 py-4 border-b border-white-light dark:border-white-light/10">
                                            {user?.avatar ? (
                                                <img
                                                    className="rounded-lg w-12 h-12 object-cover ring-2 ring-primary/20"
                                                    src={user.avatar}
                                                    alt="userProfile"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`w-12 h-12 rounded-lg ring-2 ring-primary/20 flex items-center justify-center text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary dark:from-primary/30 dark:to-primary/20 ${user?.avatar ? 'hidden' : ''}`}>
                                                {getAvatarFallback(user?.name)}
                                            </div>
                                            <div className="ltr:pl-1 rtl:pr-1 flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-[#1E2433] dark:text-white truncate">
                                                    {user ? user.name : 'Guest User'}
                                                </h4>
                                                <p className="text-xs text-black/50 dark:text-white-light/60 truncate">
                                                    {user?.email || 'guest@example.com'}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                    {user?.role !== 'superadmin' && <li>
                                        <Link to="/profile" className="flex items-center gap-3 px-4 py-3 hover:bg-white-light/50 dark:hover:bg-white-light/10 text-[#1E2433] dark:text-white-light transition-colors">
                                            <User className="w-4 h-4 shrink-0" />
                                            {t('Profile')}
                                        </Link>
                                    </li>}
                                    {user?.role === 'superadmin' && <li>
                                        <Link to="/superadmin/settings" className="flex items-center gap-3 px-4 py-3 hover:bg-white-light/50 dark:hover:bg-white-light/10 text-[#1E2433] dark:text-white-light transition-colors">
                                            <Settings className="w-4 h-4 shrink-0" />
                                            Profile & Security
                                        </Link>
                                    </li>}
                                    <li className="border-t border-white-light dark:border-white-light/10">
                                        <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-red-50/50 dark:hover:bg-red-500/10 transition-colors" onClick={handleLogout}>
                                            <LogOut className="w-4 h-4 rotate-90 shrink-0" />
                                            {t('Sign Out')}
                                        </button>
                                    </li>
                                </ul>
                            </Dropdown>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
