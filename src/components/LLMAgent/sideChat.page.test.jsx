/**
 * The side chat on the real chat page (index.jsx, rendered whole, every request faked).
 *
 * The wiring test reads the glue in the source; this one runs it: the page opens with a question
 * whose answer is still being written, the Side chat button and ⌘; open the panel beside the
 * thread, a side question carries that running turn, References bring the right pane back, and
 * the composer is the conversation's own throughout.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import '@testing-library/jest-dom';

/* eslint-disable import/first */
const mockAuth = { isAuthenticated: false, loading: false, openLoginModal: () => {}, user: null };
jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../AnswerGraph/AnswerGraphForMessage', () => () => null);
jest.mock('../../utils/gtag', () => ({
    trackGtagEvent: jest.fn(),
    createQuerySubmitSuccessTracker: () => () => {},
}));
const mockPost = jest.fn();
jest.mock('../../utils/axiosConfig', () => ({
    __esModule: true,
    // Plain functions: CRA's jest resets every jest.fn's implementation before each test.
    default: {
        get: () => new Promise(() => {}),
        post: (...args) => mockPost(...args),
        patch: () => new Promise(() => {}),
        delete: () => new Promise(() => {}),
    },
}));
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    const pricing = actual.parsePricing({
        ...actual.FALLBACK_PRICING,
        side_chat: { enabled: true, guest: true, price_as: 'low', prices: { standard: 1, advanced: 2, premium: 5 } },
    });
    return { ...actual, fetchTierPricing: () => Promise.resolve(pricing) };
});

import LLMAgent from './index';
import { SIDE_CHAT_ENDPOINT } from '../../service/sideChat';
/* eslint-enable import/first */

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
    window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || (() => {});
    window.HTMLElement.prototype.scrollTo = window.HTMLElement.prototype.scrollTo || (() => {});
    window.scrollTo = () => {};
    global.ResizeObserver = global.ResizeObserver || class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});

beforeEach(() => {
    mockPost.mockReset();
    // The main chat's stream never ends: its answer is still being written.
    mockPost.mockImplementation((url) => (url === SIDE_CHAT_ENDPOINT
        ? Promise.resolve({ data: 'data: {"step":"Complete","answer":"RFX6 is a transcription factor."}\n\n' })
        : new Promise(() => {})));
    localStorage.clear();
    sessionStorage.clear();
});

const renderPage = () => render(
    <HelmetProvider>
        <MemoryRouter initialEntries={[{ pathname: '/chat', state: { initialQuery: 'What drives islet development?' } }]}>
            <Routes>
                <Route path="/chat" element={<LLMAgent />} />
                <Route path="/chat/:publicId" element={<LLMAgent />} />
                <Route path="*" element={<div />} />
            </Routes>
        </MemoryRouter>
    </HelmetProvider>,
);

const sideChatButton = () => screen.findByRole('button', { name: /^Side chat/ });

it('opens beside a running turn, and a side question carries that turn', async () => {
    renderPage();
    const button = await sideChatButton();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    const panel = await screen.findByRole('region', { name: 'Side chat' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByText('Not saved')).toBeInTheDocument();
    expect(within(panel).getByText(/2 credits per question/)).toBeInTheDocument();

    const box = within(panel).getByRole('textbox', { name: 'Ask a side question' });
    fireEvent.change(box, { target: { value: 'What does RFX6 do?' } });
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }); });

    const call = mockPost.mock.calls.find(([url]) => url === SIDE_CHAT_ENDPOINT);
    expect(call).toBeTruthy();
    const body = call[1];
    expect(body.question).toBe('What does RFX6 do?');
    expect(body.in_progress).toMatchObject({ question: 'What drives islet development?' });
    expect(body.turns).toEqual([]);                      // a guest: nothing saved to name
    expect(body.service_tier).toBe('advanced');
    await within(panel).findByText('RFX6 is a transcription factor.');

    // Nothing reached the conversation: its only question is still the reader's own.
    expect(screen.queryAllByText('What does RFX6 do?')).toHaveLength(1);
    // The main chat's own request is the stream, never the side chat's.
    expect(mockPost.mock.calls.filter(([url]) => url === SIDE_CHAT_ENDPOINT)).toHaveLength(1);
});

it('⌘; and Ctrl+; open and close it; ✕ closes it', async () => {
    renderPage();
    await sideChatButton();
    await act(async () => { fireEvent.keyDown(window, { key: ';', metaKey: true }); });
    expect(await screen.findByRole('region', { name: 'Side chat' })).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(window, { key: ';', ctrlKey: true }); });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Side chat' })).toBeNull());
    fireEvent.click(await sideChatButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Close side chat' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Side chat' })).toBeNull());
});

it('takes the right pane, and References bring it back', async () => {
    renderPage();
    fireEvent.click(await sideChatButton());
    await screen.findByRole('region', { name: 'Side chat' });
    // (The icon renders as its file name under jest.)
    const references = screen.getByRole('button', { name: /References$/ });
    expect(references).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(references);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Side chat' })).toBeNull());
    // The composer is the conversation's, untouched: its run is still going.
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Model and effort/ })).toBeInTheDocument();
});

it('on a phone, opens as a bottom sheet over the thread', async () => {
    const desktop = window.matchMedia;
    window.matchMedia = (query) => ({
        matches: query === '(max-width: 767px)', media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Side chat' }));
        const sheet = await screen.findByRole('dialog', { name: 'Side chat' });
        expect(within(sheet).getByRole('region', { name: 'Side chat' })).toHaveClass('side-chat-sheet');
        fireEvent.click(within(sheet).getByRole('button', { name: 'Close side chat' }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Side chat' })).toBeNull());
    } finally {
        window.matchMedia = desktop;
    }
});
