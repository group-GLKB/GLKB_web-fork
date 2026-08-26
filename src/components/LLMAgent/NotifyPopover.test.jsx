/**
 * "Get notified when it's ready" — Figma 44:5967.
 *
 * What matters here is not the popover's shape but its contract with the rest of the app: it is
 * a second view of the same two preferences Settings owns, it must not write them until the
 * reader confirms, and it must not leave a switch on that can never fire.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
const confirm = () => fireEvent.click(screen.getByText('Notify me'));

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
        expect(screen.queryByText('Notify me')).not.toBeInTheDocument();
    });

    it('opens showing the preferences already stored', () => {
        window.localStorage.setItem(NOTIFY_EMAIL_KEY, '1');
        open();
        expect(rowSwitch('Email')).toBeChecked();
        expect(rowSwitch('Browser Notification')).not.toBeChecked();
    });
});

describe('confirming', () => {
    /** The frame has a Not now, so a choice has to be one the reader can back out of. */
    it('writes nothing while the switches are being moved', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        expect(getNotifyPrefs().email).toBe(false);
    });

    it('writes both preferences on Notify me', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        confirm();
        expect(getNotifyPrefs().email).toBe(true);
    });

    it('closes on Notify me', () => {
        const onClose = jest.fn();
        open({ onClose });
        confirm();
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on Not now, leaving the preferences alone', () => {
        const onClose = jest.fn();
        open({ onClose });
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Not now'));
        expect(onClose).toHaveBeenCalled();
        expect(getNotifyPrefs().email).toBe(false);
    });
});

describe('choices that cannot be honoured', () => {
    it('refuses email when the account has no address, and says why', () => {
        window.localStorage.setItem('user', JSON.stringify({}));
        open();
        fireEvent.click(rowSwitch('Email'));
        confirm();
        expect(screen.getByText(/Sign in with an email address/)).toBeInTheDocument();
        expect(getNotifyPrefs().email).toBe(false);
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
        confirm();
        expect(await screen.findByText(/blocking notifications for this site/)).toBeInTheDocument();
        expect(window.localStorage.getItem(NOTIFY_BROWSER_KEY)).not.toBe('1');
    });
});
