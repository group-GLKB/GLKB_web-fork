import './scoped.css';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../SiteChrome';
import PublicPageSeo from '../Units/PublicPageSeo';
import { buildContactMailto, CONTACT_EMAIL, CONTACT_TOPICS, openContactDraft } from './contactEmail';

const DATASET_URL = 'https://available-inventions.umich.edu/product/genomic-literature-knowledge-base';

export default function ContactPage() {
    const [name, setName] = useState('');
    const [institution, setInstitution] = useState('');
    const [topic, setTopic] = useState(CONTACT_TOPICS[0]);
    const [message, setMessage] = useState('');
    const [copyState, setCopyState] = useState('idle');
    const [formError, setFormError] = useState('');

    useEffect(() => {
        // The link starts at the About footer; do not carry that scroll offset here.
        let scroller = document.querySelector('.contact-page')?.parentElement;
        while (scroller && scroller !== document.body) {
            const { overflowY } = window.getComputedStyle(scroller);
            if (overflowY === 'auto' || overflowY === 'scroll') {
                scroller.scrollTop = 0;
                return;
            }
            scroller = scroller.parentElement;
        }
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (copyState !== 'copied') return undefined;
        const timer = window.setTimeout(() => setCopyState('idle'), 2000);
        return () => window.clearTimeout(timer);
    }, [copyState]);

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(CONTACT_EMAIL);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!name.trim() || !message.trim()) {
            setFormError('Please enter your name and a message.');
            event.currentTarget.elements.namedItem(!name.trim() ? 'name' : 'message')?.focus();
            return;
        }
        setFormError('');
        openContactDraft(buildContactMailto({ name, institution, topic, message }));
    };

    return (
        <div className="contact-page">
            <PublicPageSeo
                title="Contact Us | GLKB"
                description="Questions, feedback or a bug? Contact the GLKB team at the University of Michigan at admin@glkb.org."
            />
            <SiteNav />

            <main className="contact-main">
                <section className="contact-intro" aria-labelledby="contact-title">
                    <p className="contact-eyebrow">Contact Us</p>
                    <h1 id="contact-title">Questions, feedback<br />or a bug? Write to us.</h1>
                    <p className="contact-description">
                        The GLKB team at the University of Michigan reads every message sent to our admin inbox.
                    </p>

                    <div className="contact-email-card">
                        <p className="contact-email-label">Email</p>
                        <a className="contact-email-address" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                        <div className="contact-email-actions">
                            <button type="button" className="contact-action contact-action--secondary" onClick={copyAddress}>
                                {copyState === 'copied' ? 'Copied!' : 'Copy address'}
                            </button>
                            <a className="contact-action contact-action--primary" href={`mailto:${CONTACT_EMAIL}`}>Open email app</a>
                        </div>
                        <span className="contact-sr-only" role="status">{copyState === 'copied' ? 'Email address copied.' : ''}</span>
                        {copyState === 'failed' && <p className="contact-error" role="alert">Could not copy. Select the address above to copy it.</p>}
                    </div>

                    <p className="contact-help">
                        Looking for licensing? See the <a href={DATASET_URL} target="_blank" rel="noopener noreferrer">dataset listing</a>{' '}
                        at U-M Innovation Partnerships. Developers can start with the <Link to="/api-docs">API Docs</Link>.
                    </p>
                </section>

                <section className="contact-form-card" aria-labelledby="contact-form-title">
                    <h2 id="contact-form-title">Send a message</h2>
                    <p className="contact-form-description">We’ll open your email app with this ready to send to {CONTACT_EMAIL}.</p>

                    <form aria-label="Contact the GLKB team" action={`mailto:${CONTACT_EMAIL}`} method="post" encType="text/plain" onSubmit={handleSubmit}>
                        <div className="contact-fields">
                            <div className="contact-identity-fields">
                                <div className="contact-field">
                                    <label htmlFor="contact-name">Name</label>
                                    <input id="contact-name" name="name" autoComplete="name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} required />
                                </div>
                                <div className="contact-field">
                                    <label htmlFor="contact-institution">Institution <span className="contact-optional">(optional)</span></label>
                                    <input id="contact-institution" name="institution" autoComplete="organization" placeholder="e.g. University of Michigan" value={institution} onChange={event => setInstitution(event.target.value)} />
                                </div>
                            </div>
                            <div className="contact-field">
                                <label htmlFor="contact-topic">Topic</label>
                                <div className="contact-select">
                                    <select id="contact-topic" name="topic" value={topic} onChange={event => setTopic(event.target.value)}>
                                        {CONTACT_TOPICS.map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                            <div className="contact-field">
                                <div className="contact-message-label">
                                    <label htmlFor="contact-message">Message</label>
                                    <span className="contact-character-count">{message.length} {message.length === 1 ? 'character' : 'characters'}</span>
                                </div>
                                <textarea id="contact-message" name="message" placeholder="How can we help?" value={message} onChange={event => setMessage(event.target.value)} required />
                            </div>
                        </div>
                        {formError && <p className="contact-error" role="alert">{formError}</p>}
                        <div className="contact-submit-row">
                            <button className="contact-action contact-action--primary contact-submit" type="submit">Send to {CONTACT_EMAIL}</button>
                        </div>
                    </form>
                </section>
            </main>

            <SiteFooter withCta={false} />
        </div>
    );
}
