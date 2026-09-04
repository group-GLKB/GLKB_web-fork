/** A single Agent run owns the composer until it settles. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatSearchBar from './ChatSearchBar';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
// The composer embeds the model picker, which fetches a catalogue. Faked so these tests are
// about the composer, and so the picker's rows are known when the pipeline test reads them.
jest.mock('../../service/models', () => ({
    ...jest.requireActual('../../service/models'),
    fetchModelCatalog: () => Promise.resolve({
        models: [
            { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', short_label: '5.6 Terra', description: 'Balanced.', pipelines: ['chat', 'deep_research'] },
            { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', short_label: '5.6 Luna', description: 'Fastest.', pipelines: ['chat'] },
        ],
        defaultModel: 'gpt-5.6-terra',
        defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
    }),
}));

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
        // Nothing is racing: that run has its own session and its own history id, and the
        // backend locks per history id. So this question starts now rather than waiting, and
        // the other answer goes on being written. The field used to be disabled here, which
        // is what left "New Chat" mid-run on a composer nobody could type in.
        const elsewhere = { isLoading: true, isRunElsewhere: true };

        it('leaves the field usable', () => {
            setup(elsewhere);
            expect(field()).not.toBeDisabled();
        });

        it('says the other answer is not being interrupted', () => {
            setup(elsewhere);
            expect(
                screen.getByPlaceholderText('Ask a new question — the other answer keeps writing'),
            ).toBeInTheDocument();
        });

        it('shows no stop control — the run is not this one to stop', () => {
            setup({ ...elsewhere, userInput: '' });
            expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
        });

        it('submits on Enter, starting a second conversation', () => {
            const { onSubmit } = setup({ ...elsewhere, userInput: 'q' });
            fireEvent.keyDown(field(), { key: 'Enter' });
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        it('still refuses when the quota is gone, whoever is running', () => {
            const { onSubmit } = setup({
                ...elsewhere, userInput: 'q', isQueryLimitReached: true,
            });
            expect(field()).toBeDisabled();
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


describe('which models the composer offers', () => {
    const openPicker = async () => {
        const chip = await screen.findByRole('button', { name: /^Model: / });
        fireEvent.click(chip);
        return (await screen.findAllByRole('option')).map((o) => o.textContent);
    };

    it('offers the chat-only model on an ordinary conversation', async () => {
        setup({ pipelineIsDeepResearch: false });
        expect((await openPicker()).join(' ')).toContain('Luna');
    });

    it('hides it once the conversation is a deep-research one', async () => {
        // Includes the case the parent resolves from `isInvestigateConversation`: a reader
        // who reopens an investigate conversation from History. Offering a model deep
        // research refuses would produce a 400 they cannot act on.
        setup({ pipelineIsDeepResearch: true });
        expect((await openPicker()).join(' ')).not.toContain('Luna');
    });

    it('does not read the analytics-only `investigateEnabled` for this', async () => {
        // That prop is false for a reopened investigate conversation, which is exactly the
        // case this feature has to get right — so the pipeline comes from its own prop.
        setup({ investigateEnabled: false, pipelineIsDeepResearch: true });
        expect((await openPicker()).join(' ')).not.toContain('Luna');
    });
});
