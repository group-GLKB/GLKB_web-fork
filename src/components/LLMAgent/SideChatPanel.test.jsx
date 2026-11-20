/**
 * The side chat panel (SideChatPanel.jsx): ask about the conversation, see the answer stream in,
 * ask a follow-up, stop, copy, close. Nothing it does reaches the conversation.
 *
 * Pinned here:
 *   * it says it is a side chat and that nothing is saved, with the price of a question;
 *   * a question sends the conversation as `getContext` gives it AT SEND TIME (so a turn still
 *     being written is seen as it stands), the tier, and the quote; the answer streams in and the
 *     Complete frame's text is the one kept;
 *   * a follow-up carries the finished thread; a quote from "Ask in side chat" rides one question;
 *   * Stop keeps what arrived; an Error frame and a refusal are shown (sign-in refusals open the
 *     sign-in); credits a frame carries update the balance;
 *   * Copy copies an answer; ✕ and Esc close the panel.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import SideChatPanel from './SideChatPanel';
import { streamSideChat } from '../../service/sideChat';
import { applyStreamCredits } from '../../service/credits';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/credits', () => ({ applyStreamCredits: jest.fn() }));
jest.mock('../../service/sideChat', () => ({
    ...jest.requireActual('../../service/sideChat'),
    streamSideChat: jest.fn(),
}));

/** A fake transport: each call gets a script of frames, sent when the test says. */
const scripted = () => {
    const calls = [];
    streamSideChat.mockImplementation((body, { signal, onFrame }) => new Promise((resolve) => {
        const call = {
            body,
            signal,
            send: (...frames) => act(() => { frames.forEach((f) => onFrame(f)); }),
            end: () => act(async () => { resolve(); }),
        };
        signal?.addEventListener?.('abort', () => resolve());
        calls.push(call);
    }));
    return calls;
};

const renderPanel = (props = {}) => {
    const handlers = {
        getContext: jest.fn(() => ({ history_id: 42, in_progress: { question: 'Running?', answer: 'So far' } })),
        onClose: jest.fn(),
        onRequireSignIn: jest.fn(),
        onSettled: jest.fn(),
    };
    const utils = render(
        <SideChatPanel serviceTier="advanced" price={2} {...handlers} {...props} />,
    );
    return { ...utils, ...handlers };
};

const ask = (text) => {
    const box = screen.getByRole('textbox', { name: 'Ask a side question' });
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: 'Enter' });
};

beforeEach(() => {
    streamSideChat.mockReset();
    applyStreamCredits.mockReset();
});

it('says what it is: a side chat that is not saved, and what a question costs', () => {
    renderPanel({ mainRunning: true });
    expect(screen.getByRole('region', { name: 'Side chat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Side chat' })).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(screen.getByText(/does not search for new papers, and it is not added to the chat/)).toBeInTheDocument();
    expect(screen.getByText(/including the answer still being written/)).toBeInTheDocument();
    expect(screen.getByText(/2 credits per question · Not saved/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask a side question' })).toHaveFocus();
});

it('asks with the conversation as it stands, streams the answer and keeps the final text', async () => {
    const calls = scripted();
    const { getContext, onSettled } = renderPanel();
    ask('What does RFX6 do?');
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(calls[0].body).toEqual({
        history_id: 42,
        in_progress: { question: 'Running?', answer: 'So far' },
        question: 'What does RFX6 do?',
        thread: [],
        service_tier: 'advanced',
    });
    expect(screen.getByText('What does RFX6 do?')).toBeInTheDocument();
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    calls[0].send({ step: 'Delta', delta: 'RFX6 is a ' }, { step: 'Delta', delta: 'factor [99](x)' });
    expect(screen.getByText(/RFX6 is a factor/)).toBeInTheDocument();
    calls[0].send({ step: 'Complete', answer: 'RFX6 is a transcription factor.', credits: { charged: 2, remaining: 98 } });
    await calls[0].end();

    expect(screen.getByText('RFX6 is a transcription factor.')).toBeInTheDocument();
    expect(screen.queryByText(/\[99\]/)).toBeNull();
    expect(applyStreamCredits).toHaveBeenCalledWith({ charged: 2, remaining: 98 });
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ step: 'Complete' }));
    expect(screen.getByRole('button', { name: 'Send side question' })).toBeDisabled();
});

it('a follow-up carries the finished thread', async () => {
    const calls = scripted();
    renderPanel();
    ask('What is RFX6?');
    calls[0].send({ step: 'Complete', answer: 'A transcription factor.' });
    await calls[0].end();
    ask('And PDX1?');
    expect(calls[1].body.thread).toEqual([
        { role: 'user', content: 'What is RFX6?' },
        { role: 'assistant', content: 'A transcription factor.' },
    ]);
    expect(calls[1].body.question).toBe('And PDX1?');
});

it('"Ask in side chat" quotes the passage for one question', async () => {
    const calls = scripted();
    const { rerender, ...handlers } = renderPanel();
    rerender(
        <SideChatPanel
            serviceTier="advanced"
            getContext={handlers.getContext}
            onClose={handlers.onClose}
            seed={{ quote: 'RFX6 is required for islet formation', at: 1 }}
        />,
    );
    expect(screen.getByRole('group', { name: 'Asking about' })).toHaveTextContent('RFX6 is required for islet formation');
    ask('Which study shows this?');
    expect(calls[0].body.quote).toBe('RFX6 is required for islet formation');
    expect(screen.queryByRole('group', { name: 'Asking about' })).toBeNull();
    // The question shows the passage it was about.
    expect(screen.getByTitle('RFX6 is required for islet formation')).toBeInTheDocument();
});

it('the quote can be taken off before asking', () => {
    const calls = scripted();
    render(<SideChatPanel getContext={() => ({})} seed={{ quote: 'A passage', at: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove quote' }));
    ask('q');
    expect(calls[0].body.quote).toBeUndefined();
});

it('Stop keeps what has arrived', async () => {
    const calls = scripted();
    renderPanel();
    ask('Explain');
    calls[0].send({ step: 'Delta', delta: 'Partly written' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(calls[0].signal.aborted).toBe(true);
    await waitFor(() => expect(screen.getByText('Stopped.')).toBeInTheDocument());
    expect(screen.getByText('Partly written')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send side question' })).toBeInTheDocument();
});

it('a follow-up leaves out an exchange that failed', async () => {
    const calls = scripted();
    renderPanel();
    ask('First?');
    calls[0].send({ step: 'Error', error: 'Failed.' });
    await calls[0].end();
    ask('Second?');
    calls[1].send({ step: 'Complete', answer: 'Two.' });
    await calls[1].end();
    ask('Third?');
    expect(calls[1].body.thread).toEqual([]);
    expect(calls[2].body.thread).toEqual([
        { role: 'user', content: 'Second?' },
        { role: 'assistant', content: 'Two.' },
    ]);
});

it('Stop before any text says it was stopped, not that it failed', async () => {
    const calls = scripted();
    renderPanel();
    ask('Explain');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(calls[0].signal.aborted).toBe(true);
    await waitFor(() => expect(screen.getByText('Stopped.')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
});

it('shows an Error frame and gives the credits back on screen', async () => {
    const calls = scripted();
    renderPanel();
    ask('q');
    calls[0].send({ step: 'Error', error: 'The side chat could not answer just now.', credits: { refunded: 2, remaining: 100 } });
    await calls[0].end();
    expect(screen.getByRole('alert')).toHaveTextContent('The side chat could not answer just now.');
    expect(applyStreamCredits).toHaveBeenCalledWith({ refunded: 2, remaining: 100 });
});

it('a refusal is shown in its words, and a guest at the limit is asked to sign in', async () => {
    const error = new Error('429');
    error.refusal = { status: 429, code: 'GUEST_LIMIT_REACHED', message: 'You have used your 10 free credits.' };
    streamSideChat.mockRejectedValue(error);
    const { onRequireSignIn, onSettled } = renderPanel();
    await act(async () => { ask('q'); });
    expect(screen.getByRole('alert')).toHaveTextContent('You have used your 10 free credits.');
    expect(onRequireSignIn).toHaveBeenCalledWith('You have used your 10 free credits.');
    expect(onSettled).not.toHaveBeenCalled();
});

it('copies an answer', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const calls = scripted();
    renderPanel();
    ask('q');
    calls[0].send({ step: 'Complete', answer: 'Copy me.' });
    await calls[0].end();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy answer' })); });
    expect(writeText).toHaveBeenCalledWith('Copy me.');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

it('closes with ✕ and with Esc', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Close side chat' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Ask a side question' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
});

it('closing it mid-answer lets go of the answer', () => {
    const calls = scripted();
    const { unmount } = renderPanel();
    ask('q');
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
});

it('Shift+Enter is a new line, not a send', () => {
    const calls = scripted();
    renderPanel();
    const box = screen.getByRole('textbox', { name: 'Ask a side question' });
    fireEvent.change(box, { target: { value: 'line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(calls).toHaveLength(0);
});


it('an unknown price says nothing about credits', () => {
    renderPanel({ price: null });
    expect(screen.queryByText(/per question/)).toBeNull();
    expect(screen.getByText(/Not saved · Closes with Esc/)).toBeInTheDocument();
});

it('one credit is singular', () => {
    renderPanel({ price: 1 });
    expect(screen.getByText(/1 credit per question/)).toBeInTheDocument();
});

it('a follow-up keeps the passage an earlier question was about', async () => {
    const calls = scripted();
    render(<SideChatPanel getContext={() => ({})} seed={{ quote: 'RFX6 is required', at: 1 }} />);
    ask('Which study shows this?');
    calls[0].send({ step: 'Complete', answer: 'Smith 2010.' });
    await calls[0].end();
    ask('And in humans?');
    expect(calls[1].body.thread).toEqual([
        { role: 'user', content: 'About this passage from the conversation:\n> RFX6 is required\n\nWhich study shows this?' },
        { role: 'assistant', content: 'Smith 2010.' },
    ]);
    expect(calls[1].body.quote).toBeUndefined();
});
