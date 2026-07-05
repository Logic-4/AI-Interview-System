import { PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import App from '../../App';
import { IRootState } from '../../store';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { useInterviewStore } from '../../stores/interviewStore';
import Footer from './Footer';
import Header from './Header';
import Setting from './Setting';
import Sidebar from './Sidebar';
import Portals from '../../components/Portals';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const DefaultLayout = ({ children }: PropsWithChildren) => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const dispatch = useDispatch();
    const isImmersive = useInterviewStore((s) => s.isImmersive);

    const [showLoader, setShowLoader] = useState(true);
    const [showTopButton, setShowTopButton] = useState(false);

    const goToTop = () => {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    };

    const onScrollHandler = () => {
        if (document.body.scrollTop > 50 || document.documentElement.scrollTop > 50) {
            setShowTopButton(true);
        } else {
            setShowTopButton(false);
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', onScrollHandler);

        const screenLoader = document.getElementsByClassName('screen_loader');
        if (screenLoader?.length) {
            screenLoader[0].classList.add('animate__fadeOut');
            setTimeout(() => {
                setShowLoader(false);
            }, 200);
        }

        return () => {
            window.removeEventListener('onscroll', onScrollHandler);
        };
    }, []);

    // Keep a single component tree — toggling isImmersive must NOT remount children.
    return (
        <App>
            <div className="relative">
                {!isImmersive && (
                    <div className={`${(!themeConfig.sidebar && 'hidden') || ''} fixed inset-0 bg-[black]/60 z-50 lg:hidden`} onClick={() => dispatch(toggleSidebar())}></div>
                )}
                {!isImmersive && showLoader && (
                    <div className="screen_loader fixed inset-0 bg-[#fafafa] dark:bg-[#060818] z-[60] grid place-content-center animate__animated">
                        <LoadingSpinner size="lg" />
                    </div>
                )}
                {!isImmersive && (
                    <div className="fixed bottom-6 ltr:right-6 rtl:left-6 z-50">
                        {showTopButton && (
                            <button type="button" className="btn btn-outline-primary rounded-full p-2 animate-pulse bg-[#fafafa] dark:bg-[#060818] dark:hover:bg-primary" onClick={goToTop}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l4-4m0 0l4 4m-4-4v18" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* {!isImmersive && <Setting />} */}

                <div className={`${themeConfig.navbar} main-container text-black dark:text-white-dark min-h-screen`}>
                    {!isImmersive && <Sidebar />}

                    <div className={`main-content flex flex-col min-h-screen${isImmersive ? ' !ml-0 !w-full' : ''}`}>
                        {!isImmersive && <Header />}

                        <Suspense>
                            <div className={isImmersive ? 'p-0' : `${themeConfig.animation} p-6 animate__animated`}>
                                {children}
                            </div>
                        </Suspense>

                        {!isImmersive && <Footer />}
                        {!isImmersive && <Portals />}
                    </div>
                </div>
            </div>
        </App>
    );
};

export default DefaultLayout;
