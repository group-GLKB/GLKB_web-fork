/**
 * "Get notified when it's ready" — Figma 44:5967.
 *
 * What matters here is not the popover's shape but its contract with the rest of the app: it is
 * a second view of the same two preferences Settings owns, the switches are a DRAFT until Done,
 * and it must not leave a switch on that can never fire.
 *
 * The panel spent a few days applying each switch as it was moved. That removed the confirm
 * step, and with it any way to back out: a reader who opened the panel to look at it and
 * flicked a switch to see what it said had already changed their preferences. The draft is
 * back, and so is the button that discards it — a draft thrown away by clicking on the page
 * behind is a change the reader cannot tell they lost, so the discard has a name.
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

    /** Two buttons: one commits the draft, one throws it away. */
    it('offers both a commit and a named discard', () => {
        open();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('Not now')).toBeInTheDocument();
    });
});

describe('the switches are a draft', () => {
    it('moves the switch on screen without writing anything', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        expect(rowSwitch('Email')).toBeChecked();
        expect(getNotifyPrefs().email).toBe(false);
    });

    it('writes both preferences on Done, and closes', async () => {
        const onClose = jest.fn();
        open({ onClose });
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Done'));
        await waitFor(() => expect(getNotifyPrefs().email).toBe(true));
        expect(onClose).toHaveBeenCalled();
    });

    /** The half a confirm step exists for: turning something OFF is a choice too. */
    it('writes an OFF on Done as readily as an ON', async () => {
        window.localStorage.setItem(NOTIFY_EMAIL_KEY, '1');
        open();
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Done'));
        await waitFor(() => expect(getNotifyPrefs().email).toBe(false));
    });

    it('discards the draft on Not now', () => {
        const onClose = jest.fn();
        open({ onClose });
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Not now'));
        expect(getNotifyPrefs().email).toBe(false);
        expect(onClose).toHaveBeenCalled();
    });

    it('discards it on a click-away too, which presses no button', () => {
        open();
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(document.body);
        expect(getNotifyPrefs().email).toBe(false);
    });

    /** Reopening must not resurrect an abandoned draft. */
    it('re-seeds from storage every time it opens', () => {
        const { rerender } = render(
            <NotifyPopover anchorEl={document.body} open onClose={() => {}} />,
        );
        fireEvent.click(rowSwitch('Email'));
        expect(rowSwitch('Email')).toBeChecked();

        rerender(<NotifyPopover anchorEl={document.body} open={false} onClose={() => {}} />);
        rerender(<NotifyPopover anchorEl={document.body} open onClose={() => {}} />);
        expect(rowSwitch('Email')).not.toBeChecked();
    });

    it('asks for browser permission on Done, which is the gesture that carries it', async () => {
        global.Notification = {
            permission: 'default',
            requestPermission: jest.fn().mockResolvedValue('granted'),
        };
        open();
        fireEvent.click(rowSwitch('Browser Notification'));
        expect(global.Notification.requestPermission).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Done'));
        await waitFor(() => expect(getNotifyPrefs().browser).toBe(true));
        expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
});

describe('choices that cannot be honoured', () => {
    it('refuses email on Done when the account has no address, and says why', async () => {
        window.localStorage.setItem('user', JSON.stringify({}));
        const onClose = jest.fn();
        open({ onClose });
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(screen.getByText('Done'));

        expect(await screen.findByText(/Sign in with an email address/)).toBeInTheDocument();
        expect(getNotifyPrefs().email).toBe(false);
        expect(rowSwitch('Email')).not.toBeChecked();
        // Held open: closing on a refusal would look like the choice had been accepted.
        expect(onClose).not.toHaveBeenCalled();
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
        fireEvent.click(screen.getByText('Done'));

        expect(await screen.findByText(/blocking notifications for this site/)).toBeInTheDocument();
        expect(window.localStorage.getItem(NOTIFY_BROWSER_KEY)).not.toBe('1');
        expect(rowSwitch('Browser Notification')).not.toBeChecked();
    });

    it('still honours the email half of a press the browser half refused', async () => {
        global.Notification = {
            permission: 'default',
            requestPermission: jest.fn().mockResolvedValue('denied'),
        };
        open();
        fireEvent.click(rowSwitch('Email'));
        fireEvent.click(rowSwitch('Browser Notification'));
        fireEvent.click(screen.getByText('Done'));

        // Asking the reader to make the email choice again would be asking them to repeat one
        // that worked.
        await waitFor(() => expect(getNotifyPrefs().email).toBe(true));
        expect(getNotifyPrefs().browser).toBe(false);
    });
});
