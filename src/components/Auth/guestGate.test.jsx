import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { guestGateAction, isGuestBlockedKey, useGuestGate } from './guestGate';

const mockAuth = { isAuthenticated: false, loading: false, openLoginModal: jest.fn() };

jest.mock('./AuthContext', () => ({
    useAuth: () => mockAuth,
}));

/** A composer in miniature: something to click, something to type in. */
const Composer = ({ onSend, onType }) => {
    const { gateProps, isGuest } = useGuestGate();
    return (
        <div {...gateProps}>
            <textarea aria-label="question" onKeyDown={onType} onPaste={onType} />
            <button type="button" onClick={onSend}>Send</button>
            <span data-testid="state">{isGuest ? 'gated' : 'open'}</span>
        </div>
    );
};

const setAuth = (next) => Object.assign(mockAuth, next);

beforeEach(() => {
    mockAuth.openLoginModal = jest.fn();
    setAuth({ isAuthenticated: false, loading: false });
});

describe('what a gated interaction should do', () => {
    it('lets a signed-in reader through', () => {
        expect(guestGateAction({ isAuthenticated: true, loading: false })).toBe('allow');
    });

    it('asks a guest to sign in', () => {
        expect(guestGateAction({ isAuthenticated: false, loading: false })).toBe('sign-in');
    });

    it('waits rather than greeting an unfinished auth check with an overlay', () => {
        // The reader may well be signed in; the answer is one tick away.
        expect(guestGateAction({ isAuthenticated: false, loading: true })).toBe('wait');
    });

    it('treats a missing auth state as signed out', () => {
        expect(guestGateAction()).toBe('sign-in');
    });
});

describe('which keys a guest may still press', () => {
    it('blocks a question being typed', () => {
        expect(isGuestBlockedKey({ key: 'a' })).toBe(true);
        expect(isGuestBlockedKey({ key: 'Enter' })).toBe(true);
    });

    it('lets the reader leave the composer, and close what is open', () => {
        expect(isGuestBlockedKey({ key: 'Tab' })).toBe(false);
        expect(isGuestBlockedKey({ key: 'Escape' })).toBe(false);
        expect(isGuestBlockedKey({ key: 'ArrowDown' })).toBe(false);
    });

    it('leaves the browser its own shortcuts, but not Send', () => {
        expect(isGuestBlockedKey({ key: 'r', metaKey: true })).toBe(false);
        expect(isGuestBlockedKey({ key: 'c', ctrlKey: true })).toBe(false);
        expect(isGuestBlockedKey({ key: 'Enter', metaKey: true })).toBe(true);
    });
});

describe('the composer under the gate', () => {
    it("turns a guest's click into the sign-in overlay, and sends nothing", () => {
        const onSend = jest.fn();
        render(<Composer onSend={onSend} onType={jest.fn()} />);

        fireEvent.mouseDown(screen.getByText('Send'));
        fireEvent.click(screen.getByText('Send'));

        expect(mockAuth.openLoginModal).toHaveBeenCalled();
        expect(onSend).not.toHaveBeenCalled();
        expect(screen.getByTestId('state')).toHaveTextContent('gated');
    });

    it("keeps a guest's keystrokes out of the box", () => {
        const onType = jest.fn();
        render(<Composer onSend={jest.fn()} onType={onType} />);

        fireEvent.keyDown(screen.getByLabelText('question'), { key: 'B' });
        fireEvent.paste(screen.getByLabelText('question'));

        expect(onType).not.toHaveBeenCalled();
        expect(mockAuth.openLoginModal).toHaveBeenCalled();
    });

    it('still lets a guest tab past it', () => {
        const onType = jest.fn();
        render(<Composer onSend={jest.fn()} onType={onType} />);

        fireEvent.keyDown(screen.getByLabelText('question'), { key: 'Tab' });

        expect(onType).toHaveBeenCalled();
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
    });

    it('swallows a click made before the auth check has answered', () => {
        setAuth({ loading: true });
        const onSend = jest.fn();
        render(<Composer onSend={onSend} onType={jest.fn()} />);

        fireEvent.mouseDown(screen.getByText('Send'));
        fireEvent.click(screen.getByText('Send'));

        expect(onSend).not.toHaveBeenCalled();
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
    });

    it('is not in the way once the reader is signed in', () => {
        setAuth({ isAuthenticated: true });
        const onSend = jest.fn();
        const onType = jest.fn();
        render(<Composer onSend={onSend} onType={onType} />);

        fireEvent.mouseDown(screen.getByText('Send'));
        fireEvent.click(screen.getByText('Send'));
        fireEvent.keyDown(screen.getByLabelText('question'), { key: 'B' });

        expect(onSend).toHaveBeenCalled();
        expect(onType).toHaveBeenCalled();
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
        expect(screen.getByTestId('state')).toHaveTextContent('open');
    });
});
