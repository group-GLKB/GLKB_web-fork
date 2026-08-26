/**
 * "Notify me when Investigate finishes" — Figma 244:5280.
 *
 * Two independent channels. Email is the backend's job: the chat sends
 * `notify_email` with the run and the server sends the mail, so it survives the
 * tab being closed. Browser is ours: a Notification fired when the run lands.
 *
 * Both preferences live in localStorage because they outlast a session and are
 * read from two places — the toggle in the progress row and the rows in
 * Settings. `subscribe` keeps those in step, including across tabs.
 */
export const NOTIFY_EMAIL_KEY = 'glkb_investigate_notify_email';
export const NOTIFY_BROWSER_KEY = 'glkb_investigate_notify_browser';

const CHANGE_EVENT = 'glkb-notify-prefs-change';

const read = (key) => {
    try {
        return localStorage.getItem(key) === '1';
    } catch (error) {
        return false;
    }
};

export const getNotifyPrefs = () => ({
    email: read(NOTIFY_EMAIL_KEY),
    browser: read(NOTIFY_BROWSER_KEY),
});

export const setNotifyPref = (key, enabled) => {
    try {
        localStorage.setItem(key, enabled ? '1' : '0');
    } catch (error) {
        /* private mode: the toggle still works for this page's lifetime */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key, enabled } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** Fires on our own writes and on another tab's. */
export const subscribeToNotifyPrefs = (listener) => {
    const onLocal = () => listener(getNotifyPrefs());
    const onStorage = (event) => {
        if (!event.key || event.key === NOTIFY_EMAIL_KEY || event.key === NOTIFY_BROWSER_KEY) {
            listener(getNotifyPrefs());
        }
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
    };
};

export const browserNotifySupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export const browserNotifyPermission = () => (
    browserNotifySupported() ? Notification.permission : 'unsupported'
);

/**
 * Ask, but only when there is a point: the prompt can only be raised from a
 * user gesture, and asking again after a denial does nothing in any browser.
 */
export const requestBrowserNotifyPermission = async () => {
    if (!browserNotifySupported()) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
        return await Notification.requestPermission();
    } catch (error) {
        return Notification.permission;
    }
};

/**
 * Announce a finished run.
 *
 * Silent when the tab is already in front — the result is right there, and a
 * notification for something on screen is just noise.
 */
export const notifyRunComplete = ({ title, body, onClick } = {}) => {
    if (!browserNotifySupported()) return false;
    if (!getNotifyPrefs().browser) return false;
    if (Notification.permission !== 'granted') return false;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;

    try {
        const notification = new Notification(title || 'Investigate finished', {
            body: body || 'Your report is ready.',
            icon: '/favicon.ico',
            // One per run: re-firing with the same tag replaces rather than stacks.
            tag: 'glkb-investigate-complete',
        });
        notification.onclick = () => {
            try { window.focus(); } catch (error) { /* pop-up blocked */ }
            notification.close();
            if (typeof onClick === 'function') onClick();
        };
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * The address a completion email would go to, or '' when there is none.
 *
 * Lives here rather than beside the chat because both places that offer the email choice need
 * to know whether it can be honoured: turning it on for an account with no address is a switch
 * that will never fire.
 */
export const getUserNotifyEmail = () => {
    try {
        // Read straight from storage rather than through service/Auth's getCurrentUser, which
        // does exactly this and nothing more — importing it would pull axios, and the whole auth
        // stack behind it, into every module that only wants to know an address.
        const user = JSON.parse(window.localStorage.getItem('user') || 'null');
        const email = user?.email || user?.mail || '';
        return typeof email === 'string' ? email.trim() : '';
    } catch (error) {
        return '';
    }
};
