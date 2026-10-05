import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackGtagEvent } from '../../utils/gtag';

/* "What's new" under the research notice: one line each, so a reader sees at a glance what
   GLKB can do now. The two articles open in full on /blog; the attachments card opens the
   composer's "+" (which asks a guest to sign in first). Each card has an × that hides it for
   good in this browser: the dismissed ids are kept in localStorage, so a card added later still
   shows. Storage can be missing or throw (private window, blocked site data) — then a dismissal
   lasts until the page is reloaded, and nothing breaks. */
export const NEWS = [
    {
        id: 'attachments',
        tag: 'New in chat',
        title: 'Attach files and images',
        text: 'Add a PDF, figure, notebook, script or spreadsheet with + or just paste it, then ask about it.',
        action: 'Try it',
    },
    {
        id: 'investigate',
        tag: 'Investigate',
        title: 'Research reports you can audit',
        text: 'Searches six ways at once, quotes every paper verbatim and re-checks each claim before you see it.',
        to: '/blog/investigate-auditable-research',
        action: 'Read more',
    },
    {
        id: 'glkb',
        tag: "KDD '26",
        title: '33M abstracts, one queryable graph',
        text: '14.6M relationships linked to nine curated databases, each traceable to the sentence it came from.',
        to: '/blog/glkb-knowledge-graph',
        action: 'Read more',
    },
];

export const DISMISSED_KEY = 'glkb.whatsNew.dismissed';

const readDismissed = () => {
    try {
        const raw = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
};

const writeDismissed = (ids) => {
    try {
        window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
    } catch {
        // Not persisted; the card stays hidden for this page view only.
    }
};

const Card = ({ item, onTryAttach }) => {
    const body = (
        <>
            <span className="whats-new-tag">{item.tag}</span>
            <span className="whats-new-title">{item.title}</span>
            <span className="whats-new-text">{item.text}</span>
            <span className="whats-new-action">{item.action} <span aria-hidden="true">→</span></span>
        </>
    );
    const track = () => trackGtagEvent('home_news_click', { item: item.id });
    if (item.to) {
        return (
            <Link className="whats-new-card" to={item.to} onClick={track}>
                {body}
            </Link>
        );
    }
    return (
        <button
            type="button"
            className="whats-new-card"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
                track();
                onTryAttach?.();
            }}
        >
            {body}
        </button>
    );
};

const WhatsNew = ({ onTryAttach }) => {
    const [dismissed, setDismissed] = useState(readDismissed);
    const visible = NEWS.filter((item) => !dismissed.includes(item.id));
    if (visible.length === 0) return null;

    const dismiss = (item) => {
        trackGtagEvent('home_news_dismiss', { item: item.id });
        const next = [...dismissed, item.id];
        setDismissed(next);
        writeDismissed(next);
    };

    return (
        <section className="whats-new" aria-label="What's new">
            <h2 className="whats-new-heading">What&apos;s new</h2>
            <div className="whats-new-grid">
                {visible.map((item) => (
                    <div key={item.id} className="whats-new-item">
                        <Card item={item} onTryAttach={onTryAttach} />
                        <button
                            type="button"
                            className="whats-new-close"
                            aria-label={`Dismiss: ${item.title}`}
                            title="Dismiss"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => dismiss(item)}
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default WhatsNew;
