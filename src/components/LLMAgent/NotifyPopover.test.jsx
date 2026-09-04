/**
 * "Get notified when it's ready" — Figma 44:5967.
 *
 * What matters here is not the popover's shape but its contract with the rest of the app: it is
 * a second view of the same two preferences Settings owns, each switch takes effect as it is
 * moved, and it must not leave a switch on that can never fire.
 *
 * The switches used to be a draft that only reached storage on "Notify me", which made that
 * button a confirm step in a panel that does not look like a form — closing after moving a
 * switch silently discarded the change, including turning email OFF. Several tests below exist
 * to keep that behaviour from coming back.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import NotifyPopover from './NotifyPopover';
import {
    getNotifyPrefs,
    NOTIFY_BROWSER_KEY,
    NOTIFY_EMAIL_KEY,
} from '../../service/notifications';

const open = (props = {}) => render(
    <NotifyPopover anchorEl={document.body} open onClose={() => {}} {...props} />,
);

const rowSwitch = (label) => screen.getByLabelText(label);

beforeEach(() => {
    window.localStorage.clear();
    // The address is read out of storage, so that is where a test puts one.
    window.localStorage.setItem('user', JSON.stringify({ email: 'a@b.edu' }));
    global.Notification = { permission: 'granted', requestPermission: jest.fn() };
});

describe('what it offers', () => {
    it('names both channels, as the frame does', () => {
        open();
        expect(screen.getByText(/Get notified when it.s ready/)).toBeInTheDocument();
        expect(screen.getByText(/Choose how you.d like to hear back/)).toBeInTheDocument();
        expect(rowSwitch('Email')).toBeInTheDocument();
        expect(rowSwitch('Browser Notification')).toBeInTheDocument();
    });

    it('renders nothing until it is opened against an anchor', () => {
        const { container } = render(
            <NotifyPopover anchorEl={document.body} open={false} onClose={() => {}} />,
        );
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });

    it('opens showing the preferences already stored', () => {
        window.localStorage.setItem(NOTIFY_EMAIL_KEY, '1');
        open();
        expect(rowSwitch('Email')).toBeChecked();
        expect(rowSwitch('Browser Notification')).not.toBeChecked();
    });

    /** One button, and it decides nothing — the switches have already decided. */
    it('offers no confirm step', () => {
        open();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.queryByText('Notify me')).not.toBeInTheDocument();
        expect(screen.queryByText('Not now')).not.toBeInTheDocument();
    });
});

describe('applying', () => {
    it('writes the preference as the switch is moved', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        expect(getNotifyPrefs().email).toBe(true);
    });

    /** The half that used to be lost in silence: a reader turning notifications OFF. */
    it('writes an OFF as readily as an ON', () => {
        window.localStorage.setItem(NOTIFY_EMAIL_KEY, '1');
        open();
        fireEvent.click(rowSwitch('Email'));
        expect(getNotifyPrefs().email).toBe(false);
    });

    it('closes on Done, keeping what the switches already wrote', () => {
        const onClose = jest.fn();
        open({ onClose });
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Done'));
        expect(onClose).toHaveBeenCalled();
        expect(getNotifyPrefs().email).toBe(true);
    });

    it('keeps them through a click-away too, which has no button to press', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(document.body);
        expect(getNotifyPrefs().email).toBe(true);
    });

    it('asks for permission on the browser switch itself, which is the gesture', async () => {
        global.Notification = {
            permission: 'default',
            requestPermission: jest.fn().mockResolvedValue('granted'),
        };
        open();
        fireEvent.click(rowSwitch('Browser Notification'));
        await waitFor(() => expect(getNotifyPrefs().browser).toBe(true));
        expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
});

describe('choices that cannot be honoured', () => {
    it('refuses email when the account has no address, and says why', () => {
        window.localStorage.setItem('user', JSON.stringify({}));
        open();
        fireEvent.click(rowSwitch('Email'));
        expect(screen.getByText(/Sign in with an email address/)).toBeInTheDocument();
        expect(getNotifyPrefs().email).toBe(false);
        expect(rowSwitch('Email')).not.toBeChecked();
    });

    /**
     * A browser switch left on after a refusal is a switch that never fires. Worth a test of its
     * own because the failure is silent: requestBrowserNotifyPermission answers with a permission
     * string, and 'denied' is truthy, so a plain `if (!granted)` accepts a refusal as success.
     */
    it('turns the browser switch back off when permission is refused', async () => {
        global.Notification = {
            permission: 'default',
            requestPermission: jest.fn().mockResolvedValue('denied'),
        };
        open();
        fireEvent.click(rowSwitch('Browser Notification'));
        expect(await screen.findByText(/blocking notifications for this site/)).toBeInTheDocument();
        expect(window.localStorage.getItem(NOTIFY_BROWSER_KEY)).not.toBe('1');
        expect(rowSwitch('Browser Notification')).not.toBeChecked();
    });
});
