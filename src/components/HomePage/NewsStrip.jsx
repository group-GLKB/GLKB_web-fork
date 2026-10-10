import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';

import { INVESTIGATE_ENABLED, LITERATURE_REVIEW_ENABLED } from '../../config/features';
import { trackGtagEvent } from '../../utils/gtag';

/**
 * The news strip above the home page (design: a tag, one line of news, a link, the
 * position dots, a close). One item at a time, advancing every ROTATE_MS while the
 * pointer is not on it. Closing it hides the strip until NEWS_VERSION changes, so a new
 * set of news shows again to people who closed the old one.
 */
export const NEWS_VERSION = '2026-10-10';
const STORAGE_KEY = 'glkb-news-dismissed';
const ROTATE_MS = 6000;

export const newsItems = () => [
    {
        id: 'kdd26', tag: "KDD '26", tone: 'neutral',
        text: '33M abstracts, one queryable graph — 14.6M relationships between 3.3M terms',
        cta: 'Read more', to: '/blog/glkb-knowledge-graph',
    },
    {
        id: 'attachments', tag: 'New in chat', tone: 'green',
        text: 'Attach a PDF, figure, notebook or spreadsheet, then ask about it',
        cta: 'Try it', mode: 'chat', focus: true,
    },
    INVESTIGATE_ENABLED && {
        id: 'investigate', tag: 'Investigate', tone: 'purple',
        text: 'Deep, auditable research: every claim traced to the papers behind it, in 3–5 minutes',
        cta: 'Read more', to: '/blog/investigate-auditable-research',
    },
    LITERATURE_REVIEW_ENABLED && {
        id: 'review', tag: 'Preview', tone: 'blue',
        text: 'Literature Review: a cited draft review from one topic, in about ten minutes',
        cta: 'Try it', mode: 'review', focus: true,
    },
].filter(Boolean);

const readDismissed = () => {
    try { return window.localStorage.getItem(STORAGE_KEY) === NEWS_VERSION; } catch { return false; }
};

export default function NewsStrip({ onTry }) {
    const items = useMemo(newsItems, []);
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(readDismissed);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (dismissed || paused || items.length < 2) return undefined;
        const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
        return () => clearTimeout(timer);
    }, [index, paused, dismissed, items.length]);

    if (dismissed || !items.length) return null;
    const item = items[index];
    const open = () => {
        trackGtagEvent('home_news_click', { id: item.id });
        if (item.to) navigate(item.to);
        else onTry?.(item);
    };
    const close = () => {
        trackGtagEvent('home_news_close', { id: item.id });
        try { window.localStorage.setItem(STORAGE_KEY, NEWS_VERSION); } catch { /* per visit then */ }
        setDismissed(true);
    };

    return (
        <div
            className="news-strip"
            role="region"
            aria-label="News"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className={`news-strip-tag is-${item.tone}`}>{item.tag}</span>
            <span className="news-strip-text" title={item.text}>{item.text}</span>
            <button type="button" className="news-strip-cta" onClick={open}>
                {item.cta} <span aria-hidden="true">→</span>
            </button>
            {items.length > 1 && (
                <span className="news-strip-dots">
                    {items.map((entry, i) => (
                        <button
                            key={entry.id}
                            type="button"
                            className={`news-strip-dot${i === index ? ' is-active' : ''}`}
                            aria-label={`News ${i + 1} of ${items.length}`}
                            aria-current={i === index || undefined}
                            onClick={() => setIndex(i)}
                        />
                    ))}
                </span>
            )}
            <button type="button" className="news-strip-close" aria-label="Close news" onClick={close}>
                <CloseIcon style={{ width: 14, height: 14 }} />
            </button>
        </div>
    );
}
