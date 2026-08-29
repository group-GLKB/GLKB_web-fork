import './scoped.css';

import React, {
  Suspense,
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
import { isRunActive } from '../../service/activeRun';
import { trackGtagEvent } from '../../utils/gtag';
import LoginModal from '../Auth/LoginModal';
import PersistentAgentSurface from './PersistentAgentSurface';
import NavBarWhite from '../Units/NavBarWhite';

const SIDEBAR_OPEN_EVENT = 'glkb-open-sidebar';
const MOBILE_HEADER_NEW_CHAT_EVENT = 'glkb-mobile-header-new-chat';
const MOBILE_HEADER_VISIBILITY_EVENT = 'glkb-mobile-header-visibility';

const isPhoneUa = () => /Android|iPhone|iPod|Windows Phone|Mobile/i.test(window.navigator.userAgent || '');
const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;

const getPageTitleByPath = (pathname) => {
    if (pathname === '/') return 'GLKB: Genomic Literature Knowledge Base';
    if (pathname.startsWith('/chat')) return 'AI Chat | GLKB';
    if (pathname.startsWith('/api-page')) return 'API | GLKB';
    if (pathname.startsWith('/account')) return 'Settings | GLKB';
    if (pathname.startsWith('/about')) return 'About | GLKB';
    if (pathname.startsWith('/privacy')) return 'Privacy Policy | GLKB';
    if (pathname.startsWith('/terms')) return 'Terms of Service | GLKB';
    if (pathname.startsWith('/blog')) return 'Our Blog | GLKB';
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
    const isBlogPage = location.pathname.startsWith('/blog');
    // the legal notices stand on their own, as About and the blog do
    const isLegalPage = location.pathname.startsWith('/privacy')
        || location.pathname.startsWith('/terms');
    const isAccountPage = location.pathname.startsWith('/account');
    const isChatPage = location.pathname.startsWith('/chat');
    // Settings stands on its own, as About, the blog and the notices do: its
    // section nav is a rail already, and two rails side by side spend 300px to
    // say the same thing twice. That nav carries its own way back to the app.
    const hideSidebar = isAboutPage || isBlogPage || isLegalPage || isAccountPage;
    const showMobileHeader = isPhoneDevice && !isAboutPage && !isBlogPage && !isLegalPage
        && !isMobileHeaderHidden;

    useLayoutEffect(() => {
        document.title = getPageTitleByPath(location.pathname);
    }, [location.pathname]);

    /**
     * A conversation keeps running while the reader moves around the app, so
     * nothing warns on navigation any more. Closing the tab does end it, and
     * that can be done from any page — which is why this lives here rather than
     * in the chat, which is mounted on one route only.
     */
    useEffect(() => {
        const onBeforeUnload = (event) => {
            if (!isRunActive()) return undefined;
            event.preventDefault();
            event.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

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
                        <MenuIcon sx={{ fontSize: 22, color: 'var(--color-text-tertiary)' }} />
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
                {/*
                  The Agent owns live SSE/XHR callbacks and a large amount of in-flight state.
                  Mount it once with the app shell instead of once with the /chat route: route
                  changes now hide its view but cannot tear down the request or its state. This
                  covers ordinary chat and Investigate with the same lifecycle.
                */}
                <PersistentAgentSurface active={isChatPage}>
                    {/* The boundary sits HERE, around the routed page only, and not around the
                        whole router. A lazy page suspending inside a boundary that also
                        contained the Agent would hide the Agent's view along with it — the one
                        thing this layout exists to keep alive. `null` rather than a spinner:
                        these chunks come off the same origin and a flashed placeholder reads
                        worse than the half-beat it replaces. */}
                    <Suspense fallback={null}>
                        <Outlet />
                    </Suspense>
                </PersistentAgentSurface>
            </div>
            {/* Sign-in lives in an overlay so it can appear over any page. */}
            <LoginModal />
        </>
    );
};

export default AppLayout;
