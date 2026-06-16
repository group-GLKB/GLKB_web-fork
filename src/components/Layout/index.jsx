import './scoped.css';

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { Menu as MenuIcon } from '@mui/icons-material';

import logoIcon from '../../img/GLKB_logo_icon.png';
import logoWordmark from '../../img/navbar/logo.jpg';
import NavBarWhite from '../Units/NavBarWhite';

const FREE_BOOKMARK_BLOCKED_EVENT = 'glkb-free-bookmark-blocked';
const SIDEBAR_OPEN_EVENT = 'glkb-open-sidebar';
const MOBILE_HEADER_NEW_CHAT_EVENT = 'glkb-mobile-header-new-chat';
const MOBILE_HEADER_VISIBILITY_EVENT = 'glkb-mobile-header-visibility';

const isPhoneUa = () => /Android|iPhone|iPod|Windows Phone|Mobile/i.test(window.navigator.userAgent || '');
const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;

const getPageTitleByPath = (pathname) => {
    if (pathname === '/') return 'Home | GLKB';
    if (pathname.startsWith('/chat')) return 'AI Chat | GLKB';
    if (pathname.startsWith('/api-page')) return 'API | GLKB';
    if (pathname.startsWith('/account')) return 'Settings | GLKB';
    if (pathname.startsWith('/about')) return 'About | GLKB';
    if (pathname.startsWith('/search')) return 'Search | GLKB';
    if (pathname.startsWith('/history')) return 'History | GLKB';
    if (pathname.startsWith('/library')) return 'Library | GLKB';
    if (pathname.startsWith('/login')) return 'Login | GLKB';
    if (pathname.startsWith('/verify-code')) return 'Verify Code | GLKB';
    return 'GLKB';
};

const AppLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showBookmarkWarning, setShowBookmarkWarning] = useState(false);
    const [isPhoneDevice, setIsPhoneDevice] = useState(false);
    const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);
    const hideTimerRef = useRef(null);
    const isAboutPage = location.pathname.startsWith('/about');
    const isAccountPage = location.pathname.startsWith('/account');
    const isChatPage = location.pathname.startsWith('/chat');
    const hideSidebar = isAboutPage || (isAccountPage && !isPhoneDevice);
    const showMobileHeader = isPhoneDevice && !isAboutPage && !isMobileHeaderHidden;

    useLayoutEffect(() => {
        document.title = getPageTitleByPath(location.pathname);
    }, [location.pathname]);

    useEffect(() => {
        const evaluateIsPhone = () => {
            setIsPhoneDevice(isPhoneUa() && isPhoneViewport());
        };

        evaluateIsPhone();
        window.addEventListener('resize', evaluateIsPhone);
        return () => {
            window.removeEventListener('resize', evaluateIsPhone);
        };
    }, []);

    useEffect(() => {
        const clearHideTimer = () => {
            if (hideTimerRef.current) {
                window.clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };

        const handleBlockedBookmark = () => {
            setShowBookmarkWarning(true);
            clearHideTimer();
            hideTimerRef.current = window.setTimeout(() => {
                setShowBookmarkWarning(false);
                hideTimerRef.current = null;
            }, 5000);
        };

        window.addEventListener(FREE_BOOKMARK_BLOCKED_EVENT, handleBlockedBookmark);
        return () => {
            clearHideTimer();
            window.removeEventListener(FREE_BOOKMARK_BLOCKED_EVENT, handleBlockedBookmark);
        };
    }, []);

    useEffect(() => {
        const handleMobileHeaderVisibility = (event) => {
            setIsMobileHeaderHidden(Boolean(event?.detail?.hidden));
        };

        window.addEventListener(MOBILE_HEADER_VISIBILITY_EVENT, handleMobileHeaderVisibility);
        return () => {
            window.removeEventListener(MOBILE_HEADER_VISIBILITY_EVENT, handleMobileHeaderVisibility);
        };
    }, []);

    useEffect(() => {
        setIsMobileHeaderHidden(false);
    }, [location.pathname]);

    return (
        <>
            {showMobileHeader && (
                <header className="app-mobile-header">
                    <button
                        type="button"
                        className="app-mobile-header-context"
                        aria-label="Open sidebar"
                        onClick={() => window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_EVENT))}
                    >
                        <MenuIcon sx={{ fontSize: 22, color: '#646464' }} />
                    </button>
                    <Link to="/" className="app-mobile-header-logo-link" aria-label="GLKB Home">
                        <img src={logoIcon} alt="GLKB logo" className="app-mobile-header-logo-icon" />
                    </Link>
                    <Link to="/" className="app-mobile-header-logo-link" aria-label="GLKB Home">
                        <img src={logoWordmark} alt="GLKB" className="app-mobile-header-logo-wordmark" />
                    </Link>
                    {isChatPage && (
                        <button
                            type="button"
                            className="app-mobile-header-new-chat"
                            onClick={() => window.dispatchEvent(new CustomEvent(MOBILE_HEADER_NEW_CHAT_EVENT))}
                        >
                            New Chat
                        </button>
                    )}
                </header>
            )}
            {showBookmarkWarning && (
                <div
                    style={{
                        position: 'fixed',
                        top: 50,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 'min(838px, calc(100vw - 32px))',
                        borderRadius: 16,
                        background: '#ffffff',
                        border: '1px solid #D8D8D8',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.10)',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 24,
                        zIndex: 3000,
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div
                            style={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: 16,
                                fontWeight: 700,
                                lineHeight: 1.5,
                                color: '#27251F',
                            }}
                        >
                            Saving to Library isn't available on the free plan.
                        </div>
                        <div
                            style={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: 16,
                                fontWeight: 400,
                                lineHeight: 1.5,
                                color: '#969696',
                            }}
                        >
                            Upgrade to unlock this feature.
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled
                        style={{
                            border: '1px solid #cbd5e1',
                            background: '#e2e8f0',
                            color: '#64748b',
                            borderRadius: 16,
                            padding: '8px 12px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            cursor: 'not-allowed',
                            whiteSpace: 'nowrap',
                            opacity: 1,
                        }}
                    >
                        Upgrade
                    </button>
                </div>
            )}
            {!hideSidebar && <NavBarWhite hideCompactRail={showMobileHeader || isMobileHeaderHidden} />}
            <div className={`app-layout-content${showMobileHeader ? ' has-mobile-header' : ''}`}>
                <Outlet />
            </div>
        </>
    );
};

export default AppLayout;
