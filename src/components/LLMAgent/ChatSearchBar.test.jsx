/** A single Agent run owns the composer until it settles. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatSearchBar from './ChatSearchBar';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

const setup = (props = {}) => {
    const onSubmit = jest.fn();
    const onStop = jest.fn();
    const setUserInput = jest.fn();
    const view = render(
        <ChatSearchBar
            userInput=""
            setUserInput={setUserInput}
            isLoading={false}
            onSubmit={onSubmit}
            onStop={onStop}
            {...props}
        />,
    );
    return { onSubmit, onStop, setUserInput, view };
};

const field = () => screen.getByRole('textbox');

describe('ChatSearchBar while an answer is streaming', () => {
    it('leaves the field writable, so a follow-up can be queued', () => {
        setup({ isLoading: true });
        expect(field()).not.toBeDisabled();
    });

    it('accepts typing', () => {
        const { setUserInput } = setup({ isLoading: true });
        fireEvent.change(field(), { target: { value: 'and in mice?' } });
        expect(setUserInput).toHaveBeenCalledWith('and in mice?');
    });

    it('submits on Enter, so the follow-up can be queued', () => {
        const { onSubmit } = setup({ isLoading: true, userInput: 'and in mice?' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('offers send rather than stop once there is something to send', () => {
        const { onSubmit, onStop } = setup({ isLoading: true, userInput: 'and in mice?' });
        expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Send when this answer finishes'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onStop).not.toHaveBeenCalled();
    });

    it('offers stop while the field is empty', () => {
        const { onStop } = setup({ isLoading: true, userInput: '   ' });
        fireEvent.click(screen.getByTitle('Stop'));
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('says what will happen to the text', () => {
        setup({ isLoading: true });
        expect(
            screen.getByPlaceholderText('Ask a follow-up — it will send when this answer finishes'),
        ).toBeInTheDocument();
    });

    describe('while a DIFFERENT conversation is the one running', () => {
        // Nothing here to queue against: that run belongs to another thread, and holding a
        // question against it would fire it at a moment the reader has no reason to expect.
        const elsewhere = { isLoading: true, isRunElsewhere: true };

        it('locks the field', () => {
            setup(elsewhere);
            expect(field()).toBeDisabled();
        });

        it('says which situation it is', () => {
            setup(elsewhere);
            expect(screen.getByPlaceholderText('Another conversation is still loading'))
                .toBeInTheDocument();
        });

        it('shows no stop control — the run is not this one to stop', () => {
            setup({ ...elsewhere, userInput: '' });
            expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
        });

        it('does not submit on Enter', () => {
            const { onSubmit } = setup({ ...elsewhere, userInput: 'q' });
            fireEvent.keyDown(field(), { key: 'Enter' });
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    it('does not submit blank text', () => {
        const { onSubmit } = setup({ isLoading: true, userInput: '   ' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit while the query limit is reached, and locks the field', () => {
        const { onSubmit } = setup({ isLoading: true, userInput: 'q', isQueryLimitReached: true });
        expect(field()).toBeDisabled();
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('leaves Shift+Enter to the newline it already inserted', () => {
        const { onSubmit } = setup({ isLoading: true, userInput: 'q' });
        fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('ChatSearchBar when nothing is running', () => {
    it('sends on Enter as before', () => {
        const { onSubmit } = setup({ userInput: 'what is TP53?' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('shows the plain send title, not the queued one', () => {
        setup({ userInput: 'what is TP53?' });
        expect(screen.getByTitle('Send')).toBeInTheDocument();
    });

    it('shows no stop control', () => {
        setup({ userInput: '' });
        expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
    });
});
