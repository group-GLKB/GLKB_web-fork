/**
 * The side chat panel (2026-11-20): a quick, throwaway conversation ABOUT the chat on screen.
 *
 * Copied from Claude Code's side chat (`/btw`, ⌘;) and the Codex app's "Open Side Chat":
 *   - it sees the conversation so far, a turn still being written included (`getContext`, read
 *     when a question is sent, so it always has the newest partial answer);
 *   - it cannot search or change anything: one model call answers from the conversation and
 *     general knowledge, and says when a question needs the main chat;
 *   - it is never saved: the thread lives in this component and goes when the panel closes;
 *   - follow-ups are allowed, each one call; Stop, Copy and Close (✕ or Esc) work as in the chat.
 *
 * Rendered by the chat page beside the thread on a desktop (`variant="column"`) and as a bottom
 * sheet on a phone (`variant="sheet"`, inside the page's Drawer). Transport: service/sideChat.js.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

import {
    SIDE_CHAT_QUESTION_MAX,
    sideChatRequest,
    sideChatShortcutLabel,
    streamSideChat,
} from '../../service/sideChat';
import { applyStreamCredits } from '../../service/credits';
import { refusalNeedsSignIn, refusalText } from '../../utils/refusals';
import { trackGtagEvent } from '../../utils/gtag';
import { quotePreview } from './quoteReply';
import './SideChatPanel.css';

const STOPPED_NOTE = 'Stopped.';
const FAILED = 'The side chat could not answer just now. Please try again.';

const markdownLink = ({ node, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...props} target="_blank" rel="noopener noreferrer" />
);

/** One side answer's text as Markdown (links open in a new tab, so the conversation stays put). */
const Answer = React.memo(function Answer({ text }) {
    return (
        <div className="side-chat-markdown markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: markdownLink }}>
                {text}
            </ReactMarkdown>
        </div>
    );
});

const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(timer);
    }, [copied]);
    return (
        <button
            type="button"
            className="side-chat-icon-button"
            aria-label={copied ? 'Copied' : 'Copy answer'}
            title={copied ? 'Copied' : 'Copy'}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                } catch (error) {
                    /* clipboard refused: nothing to report beyond not showing the tick */
                }
            }}
        >
            {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
        </button>
    );
};

const SideChatPanel = ({
    getContext,
    serviceTier = '',
    price = null,
    mainRunning = false,
    seed = null,
    onClose,
    onRequireSignIn,
    onSettled,
    variant = 'column',
    autoFocus = true,
}) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [quote, setQuote] = useState('');
    const [busy, setBusy] = useState(false);
    const controllerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            // Closing the panel lets go of an answer still coming; the thread goes with it.
            controllerRef.current?.abort();
        };
    }, []);

    // "Ask in side chat" over a selection: the passage becomes this question's quote.
    useEffect(() => {
        if (!seed) return;
        if (seed.quote) setQuote(seed.quote);
        inputRef.current?.focus();
    }, [seed]);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages]);

    const patchLast = useCallback((patch) => {
        if (!mountedRef.current) return;
        setMessages((prev) => {
            if (!prev.length) return prev;
            const last = prev[prev.length - 1];
            const next = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
            return [...prev.slice(0, -1), next];
        });
    }, []);

    const send = useCallback(async () => {
        const question = input.trim();
        if (!question || busy) return;
        // The finished exchanges only: a question whose answer failed or was stopped is left out.
        const thread = [];
        for (let i = 0; i + 1 < messages.length; i += 2) {
            const [asked, answered] = [messages[i], messages[i + 1]];
            if (answered.status === 'done' && answered.content) {
                thread.push({ role: 'user', content: asked.content }, { role: 'assistant', content: answered.content });
            }
        }
        let context = {};
        try {
            context = getContext?.() || {};
        } catch (error) {
            context = {};
        }
        const body = sideChatRequest({ question, quote, thread, context, serviceTier });
        trackGtagEvent('side_chat_ask', { quoted: Boolean(quote), followup: thread.length > 0 });
        setMessages((prev) => [
            ...prev,
            { role: 'user', content: question, quote, status: 'done' },
            { role: 'assistant', content: '', status: 'streaming' },
        ]);
        setInput('');
        setQuote('');
        setBusy(true);
        const controller = new AbortController();
        controllerRef.current = controller;
        let ended = false;
        let settledFrame = null;
        let refused = false;
        try {
            await streamSideChat(body, {
                signal: controller.signal,
                onFrame: (frame) => {
                    if (frame.step === 'Delta' && typeof frame.delta === 'string') {
                        patchLast((last) => ({ ...last, content: last.content + frame.delta }));
                    } else if (frame.step === 'Complete') {
                        ended = true;
                        patchLast({ content: String(frame.answer || ''), status: 'done' });
                        if (frame.credits) applyStreamCredits(frame.credits);
                        settledFrame = frame;
                    } else if (frame.step === 'Error') {
                        ended = true;
                        patchLast({ status: 'error', error: frame.error || FAILED });
                        if (frame.credits) applyStreamCredits(frame.credits);
                        settledFrame = frame;
                    }
                },
            });
            if (controller.signal.aborted) {
                patchLast((last) => (last.status === 'streaming' ? { ...last, status: 'stopped' } : last));
            } else if (!ended) {
                patchLast((last) => (last.status === 'streaming'
                    ? { ...last, status: 'error', error: FAILED }
                    : last));
            }
        } catch (error) {
            const refusal = error?.refusal;
            refused = Boolean(refusal);
            const message = refusal ? refusalText(refusal) : FAILED;
            patchLast({ status: 'error', error: message });
            if (refusal && refusalNeedsSignIn(refusal)) onRequireSignIn?.(message);
        } finally {
            if (controllerRef.current === controller) controllerRef.current = null;
            if (mountedRef.current) {
                setBusy(false);
                inputRef.current?.focus();
            }
            // The balance moved (or may have: a Stop is still charged); `null` when the frame
            // that ended it did not say by how much.
            if (!refused) onSettled?.(settledFrame);
        }
    }, [busy, getContext, input, messages, onSettled, onRequireSignIn, patchLast, quote, serviceTier]);

    const stop = useCallback(() => {
        trackGtagEvent('side_chat_stop', {});
        controllerRef.current?.abort();
    }, []);

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose?.();
        }
    };

    const shortcut = sideChatShortcutLabel();
    const priceNote = Number.isFinite(Number(price))
        ? `${price} credit${Number(price) === 1 ? '' : 's'} per question`
        : '';

    return (
        <section
            className={`side-chat-panel side-chat-${variant}`}
            aria-label="Side chat"
            onKeyDown={onKeyDown}
        >
            <header className="side-chat-header">
                <ForumOutlinedIcon className="side-chat-header-icon" aria-hidden="true" />
                <h2 className="side-chat-title">Side chat</h2>
                <span className="side-chat-badge" title="This side conversation is not saved">Not saved</span>
                <button
                    type="button"
                    className="side-chat-icon-button side-chat-close"
                    aria-label="Close side chat"
                    title={`Close (Esc · ${shortcut})`}
                    onClick={() => onClose?.()}
                >
                    <CloseIcon fontSize="inherit" />
                </button>
            </header>
            <p className="side-chat-intro">
                Ask a quick question about this conversation. The answer uses what is already here
                {mainRunning ? ', including the answer still being written,' : ''} and general
                knowledge. It does not search for new papers, and it is not added to the chat.
            </p>
            <div className="side-chat-messages" ref={listRef} aria-live="polite" aria-busy={busy}>
                {messages.map((m, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={index} className={`side-chat-message side-chat-${m.role}`} data-status={m.status}>
                        {m.role === 'user' ? (
                            <div className="side-chat-question">
                                {m.quote ? (
                                    <blockquote className="side-chat-question-quote" title={m.quote}>
                                        {quotePreview(m.quote)}
                                    </blockquote>
                                ) : null}
                                <span>{m.content}</span>
                            </div>
                        ) : (
                            <div className="side-chat-answer">
                                {m.content ? <Answer text={m.content} /> : null}
                                {m.status === 'streaming' && !m.content ? (
                                    <span className="side-chat-thinking">Thinking…</span>
                                ) : null}
                                {m.status === 'stopped' ? (
                                    <span className="side-chat-note">{STOPPED_NOTE}</span>
                                ) : null}
                                {m.status === 'error' ? (
                                    <span className="side-chat-error" role="alert">{m.error || FAILED}</span>
                                ) : null}
                                {(m.status === 'done' || m.status === 'stopped') && m.content ? (
                                    <div className="side-chat-answer-actions">
                                        <CopyButton text={m.content} />
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <form
                className="side-chat-composer"
                onSubmit={(event) => {
                    event.preventDefault();
                    send();
                }}
            >
                {quote ? (
                    <div className="side-chat-quote" role="group" aria-label="Asking about">
                        <FormatQuoteIcon className="side-chat-quote-icon" aria-hidden="true" />
                        <span className="side-chat-quote-text" title={quote}>{quotePreview(quote)}</span>
                        <button
                            type="button"
                            className="side-chat-icon-button"
                            aria-label="Remove quote"
                            onClick={() => {
                                setQuote('');
                                inputRef.current?.focus();
                            }}
                        >
                            <CloseIcon fontSize="inherit" />
                        </button>
                    </div>
                ) : null}
                <div className="side-chat-input-row">
                    <textarea
                        ref={inputRef}
                        className="side-chat-input"
                        aria-label="Ask a side question"
                        placeholder={messages.length ? 'Ask a follow-up…' : 'Ask about this conversation…'}
                        value={input}
                        rows={2}
                        maxLength={SIDE_CHAT_QUESTION_MAX}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                                event.preventDefault();
                                send();
                            }
                        }}
                    />
                    {busy ? (
                        <button type="button" className="side-chat-send side-chat-stop" aria-label="Stop" title="Stop" onClick={stop}>
                            <span className="side-chat-stop-square" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="side-chat-send"
                            aria-label="Send side question"
                            title="Send"
                            disabled={!input.trim()}
                        >
                            <ArrowUpwardIcon fontSize="inherit" />
                        </button>
                    )}
                </div>
                <p className="side-chat-footnote">
                    {priceNote ? `${priceNote} · ` : ''}Not saved · Closes with Esc
                </p>
            </form>
        </section>
    );
};

export default SideChatPanel;
