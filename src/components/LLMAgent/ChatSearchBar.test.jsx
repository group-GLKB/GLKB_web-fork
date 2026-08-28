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
    it('locks the field', () => {
        setup({ isLoading: true });
        expect(field()).toBeDisabled();
    });

    it('does not accept typing', () => {
        const { setUserInput } = setup({ isLoading: true });
        fireEvent.change(field(), { target: { value: 'and in mice?' } });
        expect(setUserInput).not.toHaveBeenCalled();
    });

    it('does not submit on Enter', () => {
        const { onSubmit } = setup({ isLoading: true, userInput: 'and in mice?' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('offers stop while viewing the running conversation', () => {
        const { onStop } = setup({ isLoading: true, userInput: '   ' });
        fireEvent.click(screen.getByTitle('Stop'));
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('explains that the current answer must finish', () => {
        setup({ isLoading: true });
        expect(screen.getByPlaceholderText('Wait for this answer to finish')).toBeInTheDocument();
    });

    it('shows no stop control while a different conversation is open', () => {
        setup({ isLoading: true, isRunElsewhere: true });
        expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Another conversation is still loading')).toBeDisabled();
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
