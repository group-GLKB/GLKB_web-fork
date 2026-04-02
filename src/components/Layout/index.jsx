import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import NavBarWhite from '../Units/NavBarWhite';

const FREE_BOOKMARK_BLOCKED_EVENT = 'glkb-free-bookmark-blocked';

const AppLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showBookmarkWarning, setShowBookmarkWarning] = useState(false);
    const hideTimerRef = useRef(null);
    const hideSidebar = location.pathname.startsWith('/account')
        || location.pathname.startsWith('/about');

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

    return (
        <>
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
                        onClick={() => {
                            setShowBookmarkWarning(false);
                            navigate('/about#pricing');
                        }}
                        style={{
                            border: '1px solid #155DFC',
                            background: '#155DFC',
                            color: '#ffffff',
                            borderRadius: 16,
                            padding: '8px 12px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Upgrade
                    </button>
                </div>
            )}
            {!hideSidebar && <NavBarWhite />}
            <div className="app-layout-content">
                <Outlet />
            </div>
        </>
    );
};

export default AppLayout;
