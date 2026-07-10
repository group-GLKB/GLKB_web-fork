import './scoped.css';

import React, {
  useEffect,
  useLayoutEffect,
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
import logoWordmark from '../../img/navbar/logo.png';
import { trackGtagEvent } from '../../utils/gtag';
import NavBarWhite from '../Units/NavBarWhite';

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
    const [isPhoneDevice, setIsPhoneDevice] = useState(false);
    const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);
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
                        onClick={() => {
                            trackGtagEvent('mobile_header_sidebar_open_click', { source: 'layout_header' });
                            window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_EVENT));
                        }}
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
                            onClick={() => {
                                trackGtagEvent('mobile_header_new_chat_click', { source: 'layout_header' });
                                window.dispatchEvent(new CustomEvent(MOBILE_HEADER_NEW_CHAT_EVENT));
                            }}
                        >
                            New Chat
                        </button>
                    )}
                </header>
            )}
            {!hideSidebar && <NavBarWhite hideCompactRail={showMobileHeader || isMobileHeaderHidden} />}
            <div className={`app-layout-content${showMobileHeader ? ' has-mobile-header' : ''}`}>
                <Outlet />
            </div>
        </>
    );
};

export default AppLayout;
