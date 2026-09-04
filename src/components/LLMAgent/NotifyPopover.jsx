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
 * EACH SWITCH APPLIES AS IT IS MOVED. It read as a form for a while — the switches were a draft
 * and nothing was written until Notify me — which made "Notify me" a confirm button in a panel
 * that does not look like a form: moving Email off and closing the panel left email notifications
 * ON, and there was nothing on screen to say so. A switch that has already taken effect is also
 * what Settings does with the same two preferences, and the chip behind this panel re-reads them
 * live, so the effect is visible the moment the switch moves (Notify me -> Notify on). What is
 * left at the bottom is Done, which only closes.
 *
 * Browser notifications need the reader's permission, which can only be requested from a user
 * gesture — the switch itself is one, so the request happens there. A refusal turns the switch
 * back off with a line saying so, rather than leaving it on and silently never firing.
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
    subscribeToNotifyPrefs,
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
    // A view of the stored preferences, not a draft of them: every write goes through
    // setNotifyPref, and this state is refreshed from what was actually stored — including
    // writes from Settings or from another tab while the panel is open.
    const [prefs, setPrefs] = useState(() => getNotifyPrefs());
    const [error, setError] = useState('');

    useEffect(() => subscribeToNotifyPrefs(setPrefs), []);

    useEffect(() => {
        if (!open) return;
        setPrefs(getNotifyPrefs());
        setError('');
    }, [open]);

    if (!open || !anchorEl) return null;

    const toggleEmail = (next) => {
        setError('');
        // An address the server can mail. Without one the switch would be on and silent, so the
        // refusal happens here, where the switch is, instead of at a later confirm step.
        if (next && !getUserNotifyEmail()) {
            setError('Sign in with an email address to be notified by email.');
            setPrefs((prev) => ({ ...prev, email: false }));
            return;
        }
        setNotifyPref(NOTIFY_EMAIL_KEY, next);
        setPrefs((prev) => ({ ...prev, email: next }));
    };

    const toggleBrowser = async (next) => {
        setError('');
        if (!next) {
            setNotifyPref(NOTIFY_BROWSER_KEY, false);
            setPrefs((prev) => ({ ...prev, browser: false }));
            return;
        }
        // Shown on straight away: the permission prompt is modal and the switch it came from
        // should already be in the position that raised it.
        setPrefs((prev) => ({ ...prev, browser: true }));
        // A permission string, not a boolean — 'denied' is perfectly truthy, so comparing
        // against 'granted' is the only check that actually rejects a refusal.
        const permission = await requestBrowserNotifyPermission();
        if (permission !== 'granted') {
            // Saying nothing here would leave a switch on that can never fire.
            setNotifyPref(NOTIFY_BROWSER_KEY, false);
            setPrefs((prev) => ({ ...prev, browser: false }));
            setError(permission === 'denied'
                ? 'Your browser is blocking notifications for this site. Allow them in its site settings first.'
                : 'Your browser did not allow notifications.');
            return;
        }
        setNotifyPref(NOTIFY_BROWSER_KEY, true);
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
                            checked={prefs.email}
                            onChange={toggleEmail}
                        />
                        <NotifyRow
                            icon={<NotificationsNoneOutlinedIcon />}
                            label="Browser Notification"
                            checked={prefs.browser}
                            onChange={toggleBrowser}
                        />
                    </div>

                    {error ? <p className="notify-pop-error">{error}</p> : null}

                    <div className="notify-pop-actions">
                        {/* Only closes. It carries no choice of its own, so it must not read as
                            one — a second button here (the old Not now) would suggest the
                            switches above could still be backed out of. */}
                        <button type="button" className="notify-pop-confirm" onClick={onClose}>
                            Done
                        </button>
                    </div>
                </div>
            </ClickAwayListener>
        </Popper>
    );
};

export default NotifyPopover;
