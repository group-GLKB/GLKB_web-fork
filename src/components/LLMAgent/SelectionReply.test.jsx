/**
 * Select text in an answer, press Reply, and the next question replies to that passage.
 *
 * Pinned here:
 *   * the floating Reply shows over a selection inside ONE assistant answer — chat or
 *     Investigate — and nowhere else: not in a question, not across two messages, not outside
 *     the transcript;
 *   * on a touch screen it waits for the selection to settle;
 *   * Reply hands over the passage the reader sees (no citation numbers), capped;
 *   * the question carries it as a Markdown blockquote, which the question's bubble renders as
 *     one, ahead of the question;
 *   * the composer shows it as a chip with an ×, and the chip puts the cursor back in the field.
 */
import React, { useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@testing-library/jest-dom';

import SelectionReply, { TOUCH_SETTLE_MS } from './SelectionReply';
import ChatSearchBar from './ChatSearchBar';
import {
    clipQuote,
    QUOTE_MAX_CHARS,
    quotePreview,
    readAnswerSelection,
    withQuote,
} from './quoteReply';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
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

/* The transcript as MessageCard draws it: each message a `.message-card` with its role, the
   text in a `.markdown-body`; a citation is a link around an `.inline-citation-number`. */
function Transcript({ onReply, touch = false }) {
    const containerRef = useRef(null);
    return (
        <>
            <p data-testid="outside">Text outside the conversation.</p>
            <div ref={containerRef} className="messages-container">
                <div className="message-card" data-message-role="user">
                    <div className="markdown-body"><p>What does NR4A1 do?</p></div>
                </div>
                <div className="message-card" data-message-role="assistant">
                    <div className="markdown-body">
                        <p>
                            NR4A1 drives T-cell exhaustion
                            {' '}
                            <a href="https://pubmed.ncbi.nlm.nih.gov/111/"><span className="inline-citation-number">1</span></a>
                            .
                        </p>
                        <p>It also binds chromatin.</p>
                    </div>
                    <div className="message-action-row"><span>Copy</span></div>
                </div>
                <div className="message-card" data-message-role="user">
                    <div className="markdown-body"><p>And in mice?</p></div>
                </div>
                <div className="message-card" data-message-role="assistant">
                    <div className="markdown-body"><p>The investigation report says the same in mice.</p></div>
                </div>
            </div>
            <SelectionReply containerRef={containerRef} onReply={onReply} touch={touch} />
        </>
    );
}

const textNode = (text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const at = walker.currentNode.nodeValue.indexOf(text);
        if (at >= 0) return [walker.currentNode, at];
    }
    throw new Error(`no text "${text}"`);
};

const selectBetween = (from, to) => {
    const [startNode, startAt] = textNode(from);
    const [endNode, endAt] = textNode(to);
    const range = document.createRange();
    range.setStart(startNode, startAt);
    range.setEnd(endNode, endAt + to.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
};

// A mouse selection: the button is read when the mouse is let go.
const mouseSelect = async (from, to = from) => {
    fireEvent.mouseDown(document.body);
    selectBetween(from, to);
    await act(async () => {
        fireEvent.mouseUp(document.body);
        await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
};

const replyButton = () => screen.queryByRole('button', { name: 'Reply' });

afterEach(() => {
    window.getSelection().removeAllRanges();
    jest.useRealTimers();
});

describe('the Reply button over a selection', () => {
    it('shows over a passage of a chat answer and hands it over without its citation numbers', async () => {
        const onReply = jest.fn();
        render(<Transcript onReply={onReply} />);
        expect(replyButton()).toBeNull();
        await mouseSelect('NR4A1 drives', 'chromatin.');
        expect(screen.getByRole('toolbar', { name: 'Selection actions' })).toBeInTheDocument();
        fireEvent.mouseDown(replyButton());
        fireEvent.click(replyButton());
        expect(onReply).toHaveBeenCalledWith('NR4A1 drives T-cell exhaustion.\nIt also binds chromatin.');
        // The passage is handed over; the selection and the button go.
        expect(window.getSelection().rangeCount).toBe(0);
        expect(replyButton()).toBeNull();
    });

    it('works in an Investigate answer the same way', async () => {
        const onReply = jest.fn();
        render(<Transcript onReply={onReply} />);
        await mouseSelect('investigation report');
        fireEvent.click(replyButton());
        expect(onReply).toHaveBeenCalledWith('investigation report');
    });

    it('shows nothing for a selection in a question', async () => {
        render(<Transcript onReply={jest.fn()} />);
        await mouseSelect('What does NR4A1');
        expect(replyButton()).toBeNull();
    });

    it('shows nothing for a selection spanning several messages', async () => {
        render(<Transcript onReply={jest.fn()} />);
        await mouseSelect('binds chromatin', 'And in mice');
        expect(replyButton()).toBeNull();
        await mouseSelect('binds chromatin', 'investigation report');
        expect(replyButton()).toBeNull();
    });

    it('shows nothing for a selection outside the conversation', async () => {
        render(<Transcript onReply={jest.fn()} />);
        await mouseSelect('Text outside');
        expect(replyButton()).toBeNull();
    });

    it('goes away with Escape, and when the selection does', async () => {
        render(<Transcript onReply={jest.fn()} />);
        await mouseSelect('binds chromatin');
        expect(replyButton()).toBeInTheDocument();
        fireEvent.keyUp(document, { key: 'Escape' });
        expect(replyButton()).toBeNull();

        await mouseSelect('binds chromatin');
        expect(replyButton()).toBeInTheDocument();
        // A click elsewhere collapses the selection.
        fireEvent.mouseDown(document.body);
        window.getSelection().removeAllRanges();
        await act(async () => {
            fireEvent.mouseUp(document.body);
            await new Promise((resolve) => { setTimeout(resolve, 0); });
        });
        expect(replyButton()).toBeNull();
    });

    it('on a touch screen, waits for the selection to settle before it shows', () => {
        jest.useFakeTimers();
        render(<Transcript onReply={jest.fn()} touch />);
        fireEvent.touchStart(document.body);
        selectBetween('binds chromatin', 'binds chromatin');
        act(() => {
            fireEvent(document, new Event('selectionchange'));
        });
        act(() => { jest.advanceTimersByTime(TOUCH_SETTLE_MS - 50); });
        expect(replyButton()).toBeNull();
        // The handle moved again: the wait starts over.
        act(() => {
            fireEvent(document, new Event('selectionchange'));
            jest.advanceTimersByTime(TOUCH_SETTLE_MS - 50);
        });
        expect(replyButton()).toBeNull();
        act(() => { jest.advanceTimersByTime(100); });
        expect(replyButton()).toBeInTheDocument();
    });
});

describe('the quote a question carries', () => {
    it('is a Markdown blockquote — "> " on each line, a blank line, then the question', () => {
        expect(withQuote('Is this true in mice?', 'NR4A1 drives exhaustion.\n\nIt binds chromatin.'))
            .toBe('> NR4A1 drives exhaustion.\n>\n> It binds chromatin.\n\nIs this true in mice?');
        expect(withQuote('Plain question', '')).toBe('Plain question');
        expect(withQuote('Plain question', '   ')).toBe('Plain question');
    });

    it('is capped at about 1,500 characters, with an ellipsis', () => {
        const long = 'word '.repeat(600);
        const clipped = clipQuote(long);
        expect(clipped.length).toBe(QUOTE_MAX_CHARS);
        expect(clipped.endsWith('…')).toBe(true);
        expect(clipQuote('  a   b \n\n\n\n c  ')).toBe('a b\n\nc');
    });

    it("renders in the question's bubble as a blockquote ahead of the question", () => {
        const html = renderToStaticMarkup(
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {withQuote('Is this true in mice?', 'NR4A1 drives exhaustion.\n\nIt binds chromatin.')}
            </ReactMarkdown>,
        );
        expect(html).toBe(
            '<blockquote>\n<p>NR4A1 drives exhaustion.</p>\n<p>It binds chromatin.</p>\n</blockquote>\n'
            + '<p>Is this true in mice?</p>',
        );
    });

    it('is cut to one short line for the chip', () => {
        expect(quotePreview('a\n\nb')).toBe('a b');
        expect(quotePreview('x'.repeat(400)).length).toBe(160);
    });

    it('is read only from an answer body', () => {
        render(<Transcript onReply={jest.fn()} />);
        selectBetween('What does', 'What does');
        expect(readAnswerSelection(document.body)).toBeNull();
        selectBetween('It also binds', 'It also binds');
        expect(readAnswerSelection(document.body)).toEqual(expect.objectContaining({ text: 'It also binds' }));
        // An end that strays past the answer with nothing selected out there is clamped back.
        const [node] = textNode('It also binds chromatin.');
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(textNode('Copy')[0], 0);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        expect(readAnswerSelection(document.body)).toEqual(expect.objectContaining({ text: 'It also binds chromatin.' }));
    });
});

describe('the composer with a quote', () => {
    it('shows it above the field, and × drops it and puts the cursor back in the field', async () => {
        const onRemoveQuote = jest.fn();
        const Harness = () => {
            const inputRef = useRef(null);
            return (
                <ChatSearchBar
                    userInput=""
                    setUserInput={jest.fn()}
                    isLoading={false}
                    onSubmit={jest.fn()}
                    onStop={jest.fn()}
                    quote={'NR4A1 drives T-cell exhaustion. '.repeat(10)}
                    onRemoveQuote={onRemoveQuote}
                    inputRef={inputRef}
                />
            );
        };
        render(<Harness />);
        await act(async () => {});   // the model picker's prices
        const chip = screen.getByRole('group', { name: 'Replying to' });
        expect(chip).toHaveTextContent(/^NR4A1 drives T-cell exhaustion\./);
        expect(chip.textContent.length).toBeLessThan(200);
        expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Ask about the quoted text…');
        fireEvent.click(screen.getByRole('button', { name: 'Remove quote' }));
        expect(onRemoveQuote).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('shows nothing without one', async () => {
        render(
            <ChatSearchBar userInput="" setUserInput={jest.fn()} isLoading={false} onSubmit={jest.fn()} onStop={jest.fn()} />,
        );
        await act(async () => {});
        expect(screen.queryByRole('group', { name: 'Replying to' })).toBeNull();
    });
});
