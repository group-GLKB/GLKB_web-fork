/**
 * "Get notified when it's ready", from Figma 44:5967 — the popover behind Notify me on the
 * investigate panel.
 *
 * Notify me used to be a straight toggle on email alone: one click, no confirmation, and no way
 * to reach the browser notification the app also supports. The design makes it a choice between
 * the two, which is also the only place a reader is asked at the moment they care — Settings has
 * the same two switches, and both write the same preferences, so a choice made here is the one
 * Settings shows afterwards.
 *
 * Browser notifications need the reader's permission, which can only be requested from a gesture.
 * That request therefore happens on Notify me rather than on the switch, and a refusal turns the
 * switch back off with a line saying so instead of leaving it on and silently never firing.
 */
import React, { useEffect, useState } from 'react';
import { ClickAwayListener, Popper } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';

import {
    getNotifyPrefs,
    getUserNotifyEmail,
    NOTIFY_BROWSER_KEY,
    NOTIFY_EMAIL_KEY,
    requestBrowserNotifyPermission,
    setNotifyPref,
} from '../../service/notifications';
import { Switch } from '../Units/Switch';

const NotifyRow = ({ icon, label, checked, onChange }) => (
    <div className="notify-pop-row">
        <span className="notify-pop-row-label">
            <span className="notify-pop-row-icon">{icon}</span>
            {label}
        </span>
        <Switch
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            inputProps={{ 'aria-label': label }}
        />
    </div>
);

const NotifyPopover = ({ anchorEl, open, onClose }) => {
    // Seeded from the stored preferences, then held locally: the design has a Not now, and a
    // choice the reader can back out of cannot be written as they make it.
    const [draft, setDraft] = useState(() => getNotifyPrefs());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setDraft(getNotifyPrefs());
        setError('');
    }, [open]);

    if (!open || !anchorEl) return null;

    const confirm = async () => {
        // An address the server can mail. Without one the switch would be on and silent.
        if (draft.email && !getUserNotifyEmail()) {
            setDraft((prev) => ({ ...prev, email: false }));
            setError('Sign in with an email address to be notified by email.');
            return;
        }
        if (draft.browser) {
            // A permission string, not a boolean — 'denied' is perfectly truthy, so comparing
            // against 'granted' is the only check that actually rejects a refusal.
            const permission = await requestBrowserNotifyPermission();
            if (permission !== 'granted') {
                // Saying nothing here would leave a switch on that can never fire.
                setDraft((prev) => ({ ...prev, browser: false }));
                setError(permission === 'denied'
                    ? 'Your browser is blocking notifications for this site. Allow them in its site settings first.'
                    : 'Your browser did not allow notifications.');
                setNotifyPref(NOTIFY_BROWSER_KEY, false);
                setNotifyPref(NOTIFY_EMAIL_KEY, draft.email);
                return;
            }
        }
        setNotifyPref(NOTIFY_BROWSER_KEY, draft.browser);
        setNotifyPref(NOTIFY_EMAIL_KEY, draft.email);
        onClose();
    };

    return (
        <Popper
            open
            anchorEl={anchorEl}
            placement="bottom-end"
            modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
            className="notify-pop-layer"
        >
            <ClickAwayListener onClickAway={onClose}>
                <div className="notify-pop" role="dialog" aria-label="Get notified when it's ready">
                    <div className="notify-pop-head">
                        <p className="notify-pop-title">Get notified when it&apos;s ready</p>
                        <p className="notify-pop-subtitle">Choose how you&apos;d like to hear back.</p>
                    </div>

                    <div className="notify-pop-rows">
                        <NotifyRow
                            icon={<MailOutlineIcon />}
                            label="Email"
                            checked={draft.email}
                            onChange={(next) => setDraft((prev) => ({ ...prev, email: next }))}
                        />
                        <NotifyRow
                            icon={<NotificationsNoneOutlinedIcon />}
                            label="Browser Notification"
                            checked={draft.browser}
                            onChange={(next) => {
                                setError('');
                                setDraft((prev) => ({ ...prev, browser: next }));
                            }}
                        />
                    </div>

                    {error ? <p className="notify-pop-error">{error}</p> : null}

                    <div className="notify-pop-actions">
                        <button type="button" className="notify-pop-dismiss" onClick={onClose}>
                            Not now
                        </button>
                        <button type="button" className="notify-pop-confirm" onClick={confirm}>
                            Notify me
                        </button>
                    </div>
                </div>
            </ClickAwayListener>
        </Popper>
    );
};

export default NotifyPopover;
