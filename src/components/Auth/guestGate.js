/**
 * Asking a question is for signed-in readers.
 *
 * The server refuses a guest's question, so the only thing a guest can get out of the
 * composer is an error several seconds after they pressed Enter — with their question
 * already gone from the box. The gate turns that into the one thing they can act on: the
 * sign-in overlay, opened before anything is sent.
 *
 * It is applied to a whole region rather than to each control, in the CAPTURE phase, so a
 * new button inside the composer is gated the day it is added instead of the day someone
 * remembers to gate it. The composer stays visible and unchanged — a guest should see what
 * they are signing in for.
 */
import { useCallback, useMemo } from 'react';

import { useAuth } from './AuthContext';

/* Keys that only move the caret or leave the control. A guest must still be able to tab
   past a composer they are not allowed to type in, and Escape must still close things. */
const NAVIGATION_KEYS = new Set([
    'Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown',
]);

/** Whether this key press is the reader trying to USE the region, not merely move through it. */
export const isGuestBlockedKey = (event) => {
    if (!event || typeof event.key !== 'string') return false;
    if (NAVIGATION_KEYS.has(event.key)) return false;
    /* Browser and OS shortcuts (copy, reload, the devtools) belong to the reader, not to the
       page — except Cmd/Ctrl+Enter, which some composers read as "send". */
    if ((event.metaKey || event.ctrlKey) && event.key !== 'Enter') return false;
    return true;
};

/**
 * What an interaction in a gated region should do.
 *
 * `wait` is the window between mount and the auth check finishing: the reader may well be
 * signed in, and greeting them with a sign-in overlay for a click they made a moment too
 * early would be wrong. The interaction is swallowed instead, and their next one lands.
 */
export const guestGateAction = ({ isAuthenticated, loading } = {}) => {
    if (isAuthenticated) return 'allow';
    return loading ? 'wait' : 'sign-in';
};

const NO_GATE = Object.freeze({});

/**
 * `gateProps` spreads onto the element wrapping everything that can send a question;
 * `requireAuth(event)` is the same decision for a handler that has no element to sit on
 * (a programmatic submit), and returns true when it took the interaction over.
 */
export const useGuestGate = () => {
    const { isAuthenticated, loading, openLoginModal } = useAuth();
    const action = guestGateAction({ isAuthenticated, loading });

    const requireAuth = useCallback((event) => {
        if (action === 'allow') return false;
        if (event) {
            event.preventDefault?.();
            // Capture phase: this is what keeps the click off the controls underneath.
            event.stopPropagation?.();
        }
        if (action === 'sign-in') openLoginModal();
        return true;
    }, [action, openLoginModal]);

    const gateProps = useMemo(() => (action === 'allow' ? NO_GATE : {
        // mousedown rather than click alone: it is what would have focused the textarea.
        onMouseDownCapture: requireAuth,
        onClickCapture: requireAuth,
        onKeyDownCapture: (event) => {
            if (isGuestBlockedKey(event)) requireAuth(event);
        },
        onPasteCapture: requireAuth,
    }), [action, requireAuth]);

    return { isGuest: action !== 'allow', requireAuth, gateProps };
};
