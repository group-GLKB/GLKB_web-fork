import React from 'react';
import { Link } from 'react-router-dom';
import { trackGtagEvent } from '../../utils/gtag';

/* "What's new" under the research notice: one line each, so a reader sees at a glance what
   GLKB can do now. The two articles open in full on /blog; the attachments card opens the
   composer's "+" (which asks a guest to sign in first). */
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

const WhatsNew = ({ onTryAttach }) => (
    <section className="whats-new" aria-label="What's new">
        <h2 className="whats-new-heading">What&apos;s new</h2>
        <div className="whats-new-grid">
            {NEWS.map((item) => (
                <Card key={item.id} item={item} onTryAttach={onTryAttach} />
            ))}
        </div>
    </section>
);

export default WhatsNew;
