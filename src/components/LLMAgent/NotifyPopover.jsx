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
 * THE SWITCHES ARE A DRAFT. Nothing reaches storage until Done, and Not now (or a click away)
 * leaves the stored preferences exactly as they were. The panel is a small form and is built
 * like one: two switches and two buttons, one of which commits and one of which does not.
 *
 * This is deliberately not the "each switch applies as it is moved" behaviour that sat here for
 * a few days. That version had no way to back out of a switch — a reader who opened the panel to
 * look at it and moved a switch to see what it said had already changed their preferences — and
 * it left Done as a button that did nothing but close. What it did solve is worth keeping in
 * mind: a draft discarded on close is silent, so the discard is given a name (Not now) rather
 * than being left to a click on the page behind.
 *
 * Browser notifications need the reader's permission, which can only be requested from a user
 * gesture — pressing Done is one, so the request happens there, before anything is written. A
 * refusal turns the switch back off with a line saying so and holds the panel open, rather than
 * storing a preference that could never fire.
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
    // Seeded from the stored preferences, then held locally: a choice the reader can back out
    // of with Not now cannot be written as they make it. Re-seeded on every open, so the panel
    // always starts from what is actually stored — including a write Settings made meanwhile.
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
                // The email half of the same press still stands: it was honourable, and asking
                // for it again would be asking the reader to repeat a choice that worked.
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
                            onChange={(next) => {
                                setError('');
                                setDraft((prev) => ({ ...prev, email: next }));
                            }}
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
                        {/* The discard, named. A draft thrown away by clicking on the page
                            behind is a change the reader cannot tell they lost; this is the
                            way out that says what it does. */}
                        <button type="button" className="notify-pop-dismiss" onClick={onClose}>
                            Not now
                        </button>
                        <button type="button" className="notify-pop-confirm" onClick={confirm}>
                            Done
                        </button>
                    </div>
                </div>
            </ClickAwayListener>
        </Popper>
    );
};

export default NotifyPopover;
