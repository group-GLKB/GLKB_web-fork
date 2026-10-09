/** A single Agent run owns the composer until it settles. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatSearchBar from './ChatSearchBar';
import { trackGtagEvent } from '../../utils/gtag';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
// The composer embeds the tier picker, which fetches the prices. Faked so these tests are
// about the composer, and so the picker's rows are known when the pipeline test reads them.
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
    };
});

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    trackGtagEvent.mockClear();
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
    it('tracks a question in a resolved Investigate conversation', () => {
        const { onSubmit } = setup({
            userInput: 'what is TP53?',
            investigateEnabled: false,
            pipelineIsDeepResearch: true,
        });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(trackGtagEvent).toHaveBeenCalledWith('investigate_question_submit', {
            source: 'chat_searchbar',
            input_method: 'enter',
            queued: false,
        });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does not emit the Investigate question event in an ordinary conversation', () => {
        setup({ userInput: 'what is TP53?', pipelineIsDeepResearch: false });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(trackGtagEvent).not.toHaveBeenCalledWith(
            'investigate_question_submit',
            expect.anything(),
        );
    });

    it('sends on Enter as before', () => {
        const { onSubmit } = setup({ userInput: 'what is TP53?' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { queryMethod: 'enter' });
    });

    it('labels a send-button submission separately', () => {
        const { onSubmit } = setup({ userInput: 'what is BRCA1?' });
        fireEvent.click(screen.getByTitle('Send'));
        expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { queryMethod: 'button' });
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


describe('the tier the composer offers', () => {
    const openPicker = async () => {
        const chip = await screen.findByRole('button', { name: /^Model: / });
        fireEvent.click(chip);
        return (await screen.findAllByRole('option')).map((o) => o.textContent).join(' ');
    };

    it('prices an ordinary conversation as AI Chat', async () => {
        setup({ pipelineIsDeepResearch: false, serviceTier: 'standard' });
        const text = await openPicker();
        expect(text).toContain('10 credits/query');
        expect(text).toContain('1 credit/query');
    });

    it('prices a deep-research conversation as Investigate', async () => {
        // Includes the case the parent resolves from `isInvestigateConversation`: a reader who
        // reopens an investigate conversation from History.
        setup({ pipelineIsDeepResearch: true, serviceTier: 'standard' });
        const text = await openPicker();
        expect(text).toContain('45 credits/query');
        expect(text).toContain('20 credits/query');
    });

    it('does not read the analytics-only `investigateEnabled` for this', async () => {
        setup({ investigateEnabled: false, pipelineIsDeepResearch: true, serviceTier: 'standard' });
        expect(await openPicker()).toContain('45 credits/query');
    });

    it("asks a guest to sign in for GPT-6.1 Sol instead of selecting it", async () => {
        const onRequireSignIn = jest.fn();
        const onServiceTierChange = jest.fn();
        setup({ isGuest: true, serviceTier: 'standard', onRequireSignIn, onServiceTierChange });
        await openPicker();
        fireEvent.click(screen.getByRole('option', { name: /GPT-6.1 Sol/ }));
        expect(onRequireSignIn).toHaveBeenCalled();
        expect(onServiceTierChange).not.toHaveBeenCalled();
    });
});

describe('attachments', () => {
    const controller = (overrides = {}) => ({
        items: [],
        notice: '',
        readyAttachments: [],
        isUploading: false,
        hasErrors: false,
        hasItems: false,
        addFiles: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn(),
        showNotice: jest.fn(),
        ...overrides,
    });
    const readyPdf = {
        key: 'k1',
        kind: 'pdf',
        name: 'paper.pdf',
        size: 10,
        status: 'ready',
        attachment: { id: 'p1', kind: 'pdf', filename: 'paper.pdf', page_count: 2, size_bytes: 10 },
    };
    const withReadyPdf = (overrides = {}) => controller({
        items: [readyPdf],
        readyAttachments: [readyPdf.attachment],
        hasItems: true,
        ...overrides,
    });
    const paperclip = () => screen.getByRole('button', { name: 'Add files or photos' });

    it('shows no + button when the parent offers no attachments', () => {
        setup();
        expect(screen.queryByRole('button', { name: 'Add files or photos' })).not.toBeInTheDocument();
    });

    it('asks a guest to sign in instead of opening the file picker', () => {
        const onAttachRequireSignIn = jest.fn();
        setup({ isGuest: true, attachments: controller(), onAttachRequireSignIn });
        fireEvent.click(paperclip());
        expect(onAttachRequireSignIn).toHaveBeenCalledTimes(1);
    });

    it('is off in an Investigate conversation', () => {
        setup({ pipelineIsDeepResearch: true, attachments: controller() });
        expect(paperclip()).toBeDisabled();
    });

    it('sends a question that is only files', () => {
        const { onSubmit } = setup({ attachments: withReadyPdf() });
        expect(screen.getByText('paper.pdf')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Send'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('holds the send back while a file is uploading', () => {
        const { onSubmit } = setup({
            userInput: 'what does it show?',
            attachments: withReadyPdf({ isUploading: true }),
        });
        fireEvent.click(screen.getByTitle('Send'));
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('holds files back from an Investigate conversation, and says so', () => {
        const { onSubmit } = setup({
            userInput: 'and this figure?',
            pipelineIsDeepResearch: true,
            attachments: withReadyPdf(),
        });
        expect(screen.getByRole('status')).toHaveTextContent('Attachments work in AI Chat');
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('takes pasted files of any type, and leaves a short text paste alone', () => {
        const attachments = controller();
        setup({ attachments });
        const image = new File(['x'], 'image.png', { type: 'image/png' });
        const script = new File(['print(1)'], 'analysis.py', { type: 'text/x-python' });
        fireEvent.paste(field(), { clipboardData: { files: [image, script], items: [] } });
        expect(attachments.addFiles).toHaveBeenCalledWith([image, script]);
        attachments.addFiles.mockClear();
        fireEvent.paste(field(), { clipboardData: { files: [], items: [], getData: () => 'text' } });
        expect(attachments.addFiles).not.toHaveBeenCalled();
    });

    it('turns a very long text paste into "Pasted text.txt", as Claude does', () => {
        const attachments = controller();
        const { setUserInput } = setup({ attachments });
        const long = 'x'.repeat(4001);
        fireEvent.paste(field(), { clipboardData: { files: [], items: [], getData: () => long } });
        expect(attachments.addFiles).toHaveBeenCalledTimes(1);
        const [[pasted]] = attachments.addFiles.mock.calls[0];
        expect(pasted.name).toBe('Pasted text.txt');
        expect(pasted.size).toBe(4001);
        expect(setUserInput).not.toHaveBeenCalled();
    });

    it('lets a long paste land in the box where nothing can be attached (Investigate)', () => {
        const attachments = controller();
        setup({ attachments, pipelineIsDeepResearch: true });
        fireEvent.paste(field(), { clipboardData: { files: [], items: [], getData: () => 'x'.repeat(5000) } });
        expect(attachments.addFiles).not.toHaveBeenCalled();
    });

    it('leads the field with the +, whose menu has the one entry', () => {
        setup({ attachments: controller() });
        const button = paperclip();
        // Before the text box, as in ChatGPT.
        expect(button.compareDocumentPosition(field()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(button);
        expect(screen.getByRole('menuitem', { name: /Add photos and files/ })).toBeInTheDocument();
        expect(screen.queryByText(/Paste from clipboard/)).not.toBeInTheDocument();
    });

    it('takes files dropped on the composer', () => {
        const attachments = controller();
        setup({ attachments });
        const doc = new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' });
        const target = document.querySelector('.chat-header > div');
        fireEvent.drop(target, { dataTransfer: { types: ['Files'], files: [doc], items: [] } });
        expect(attachments.addFiles).toHaveBeenCalledWith([doc]);
    });
});
