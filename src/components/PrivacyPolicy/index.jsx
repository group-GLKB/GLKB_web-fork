/**
 * The privacy notice, from Figma 1186:3618. The text comes from policy.js,
 * which is extracted from the source document rather than retyped.
 */
import './scoped.css';

import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

import { SiteFooter, SiteNav } from '../SiteChrome';
import { LAST_UPDATED, POLICY } from './policy';

const CONTACT = 'admin@glkb.org';

/** The contact address is a link wherever it appears in a paragraph. */
const withContactLink = (text) => {
    const parts = text.split(CONTACT);
    if (parts.length === 1) return text;
    return parts.flatMap((part, index) => (index === 0
        ? [part]
        : [
            <a key={`mail-${index}`} href={`mailto:${CONTACT}`}>{CONTACT}</a>,
            part,
        ]));
};

const Block = ({ kind, text }) => {
    switch (kind) {
        case 'h':
            return <h2 className="privacy-heading">{text}</h2>;
        case 'li':
            return <li className="privacy-item">{withContactLink(text)}</li>;
        case 'li2':
            return <li className="privacy-item privacy-item--nested">{withContactLink(text)}</li>;
        default:
            return <p className="privacy-p">{withContactLink(text)}</p>;
    }
};

/**
 * The document nests its lists two deep, but the frame only ever draws one rank
 * of dashes. Where a section has a second rank, its first rank reads as lead-in
 * prose — "... may include:" — so those become paragraphs and the nested items
 * become the dashes. Sections with one rank keep it as dashes.
 */
const flattenLists = (blocks) => {
    const out = [];
    let section = [];

    const flush = () => {
        const nested = section.some(([kind]) => kind === 'li2');
        section.forEach(([kind, text]) => {
            if (!nested) out.push([kind, text]);
            else if (kind === 'li') out.push(['p', text]);
            else if (kind === 'li2') out.push(['li', text]);
            else out.push([kind, text]);
        });
        section = [];
    };

    blocks.forEach(([kind, text]) => {
        if (kind === 'h') { flush(); out.push(['h', text]); return; }
        section.push([kind, text]);
    });
    flush();
    return out;
};

/** Runs of bullets become one list, so the markup is a list rather than rows. */
const grouped = (blocks) => {
    const out = [];
    blocks.forEach(([kind, text]) => {
        const isItem = kind === 'li' || kind === 'li2';
        const tail = out[out.length - 1];
        if (isItem && tail && tail.list) tail.items.push([kind, text]);
        else if (isItem) out.push({ list: true, items: [[kind, text]] });
        else out.push({ list: false, block: [kind, text] });
    });
    return out;
};

const PrivacyPolicy = () => {
    useEffect(() => {
        // AppLayout scrolls an inner wrapper rather than the window.
        let el = document.querySelector('.privacy-page')?.parentElement;
        while (el && el !== document.body) {
            const { overflowY } = window.getComputedStyle(el);
            if (overflowY === 'auto' || overflowY === 'scroll') { el.scrollTop = 0; return; }
            el = el.parentElement;
        }
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="privacy-page">
            <Helmet>
                <title>Privacy Policy | GLKB</title>
                <meta name="description" content="How GLKB collects, uses and shares personal information." />
            </Helmet>

            <SiteNav />

            <main className="privacy-body">
                <h1 className="privacy-title">Privacy Policy</h1>
                <p className="privacy-updated">{LAST_UPDATED}</p>

                {grouped(flattenLists(POLICY)).map((entry, index) => (entry.list ? (
                    // eslint-disable-next-line react/no-array-index-key
                    <ul className="privacy-list" key={`list-${index}`}>
                        {entry.items.map(([kind, text]) => (
                            <Block key={text.slice(0, 48)} kind={kind} text={text} />
                        ))}
                    </ul>
                ) : (
                    <Block key={entry.block[1].slice(0, 48)} kind={entry.block[0]} text={entry.block[1]} />
                )))}
            </main>

            <SiteFooter withCta={false} />
        </div>
    );
};

export default PrivacyPolicy;
