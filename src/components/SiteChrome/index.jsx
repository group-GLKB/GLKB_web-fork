/**
 * The marketing shell — the navigation bar, the closing call to action and the
 * post card, from Figma 604:7226.
 *
 * About and the blog articles are one site: the articles are listed on About
 * under "From the Lab", and both ends of every page are these components.
 */
import './scoped.css';

import React from 'react';
import { useNavigate } from 'react-router-dom';

// The app's own mark and wordmark, not the About-only lockup that used to sit here:
// this is one site, and the logo above the marketing pages is the logo above the app.
import siteMark from '../../img/GLKB_logo_icon.png';
import siteWordmark from '../../img/navbar/logo.png';

/** Where the article list lives now that About owns it. */
export const BLOG_LIST_PATH = '/about#from-the-lab';

const DATASET_URL = 'https://available-inventions.umich.edu/product/genomic-literature-knowledge-base';

/**
 * `onGetStarted` is passed in rather than reached for: the shell has no business
 * knowing about auth, and pulling AuthContext in here drags axios into the test
 * graph of every page that renders a nav.
 */
export const SiteNav = ({ active, onGetStarted }) => {
    const navigate = useNavigate();

    return (
        <header className="site-nav">
            <button
                type="button"
                className="site-nav-logo"
                onClick={() => navigate('/about')}
                aria-label="GLKB"
            >
                <img className="site-logo-mark" src={siteMark} alt="" />
                <img className="site-logo-wordmark" src={siteWordmark} alt="GLKB" />
            </button>
            <nav className="site-nav-actions">
                {active === 'home' ? null : (
                    <button type="button" className="site-nav-link" onClick={() => navigate('/about')}>
                        Home
                    </button>
                )}
                {/* Our Blog is hidden from the bar. The articles are a section of About
                    rather than a page of their own, so the link pointed at an anchor on
                    the page the reader was most likely already on. They are still reached
                    from "From the Lab", and BLOG_LIST_PATH still routes. */}
                <button
                    type="button"
                    className="site-nav-link"
                    onClick={() => window.open(DATASET_URL, '_blank', 'noopener,noreferrer')}
                >
                    License the Dataset
                </button>
                <button
                    type="button"
                    className="site-nav-cta"
                    onClick={onGetStarted || (() => navigate('/'))}
                >
                    Get Started
                </button>
            </nav>
        </header>
    );
};

export const SiteFooter = ({ withCta = true }) => {
    const navigate = useNavigate();

    return (
        <>
            {withCta && (
            <section className="site-cta">
                <p className="site-cta-eyebrow">Get Started</p>
                <h2 className="site-cta-title">Start your literature review in minutes.</h2>
                <div className="site-cta-actions">
                    <button type="button" className="site-button" onClick={() => navigate('/')}>
                        Try GLKB
                    </button>
                    <button type="button" className="site-button site-button--ghost" onClick={() => navigate('/')}>
                        View Demo
                    </button>
                </div>
            </section>
            )}
            <footer className="site-footer">
                <span className="site-footer-logo">
                    <img className="site-logo-mark" src={siteMark} alt="" />
                    <img className="site-logo-wordmark" src={siteWordmark} alt="GLKB" />
                </span>
                <div className="site-footer-row">
                    <div className="site-footer-links">
                        <button type="button" onClick={() => navigate('/terms')}>Terms of Use</button>
                        <button type="button" onClick={() => navigate('/privacy')}>Privacy Policy</button>
                        <button type="button">Refund &amp; Cancellation</button>
                        <button type="button">Contact Us</button>
                    </div>
                    <span className="site-footer-copyright">© 2026 Liu Lab</span>
                </div>
            </footer>
        </>
    );
};

/**
 * Figma 604:7276 — a 17px-padded card: muted thumbnail, date, one-line title
 * and an excerpt clamped to two lines.
 */
export const PostCard = ({ post, onOpen }) => (
    <button type="button" className="site-card" onClick={() => onOpen(post.slug)}>
        <span className="site-card-thumb">
            {post.thumb ? <img src={post.thumb} alt="" /> : null}
        </span>
        <span className="site-card-date">{post.date}</span>
        <span className="site-card-title" title={post.cardTitle || post.title}>
            {post.cardTitle || post.title}
        </span>
        <span className="site-card-excerpt">{post.lede}</span>
    </button>
);

export default SiteNav;
