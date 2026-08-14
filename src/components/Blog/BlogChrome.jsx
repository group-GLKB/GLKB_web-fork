/**
 * The shared blog shell — the navigation bar and footer from Figma 707:2705,
 * which both the article and the index render inside.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import blogLogo from '../../img/GLKB_logo_icon.png';

export const BlogNav = ({ active }) => {
    const navigate = useNavigate();
    return (
        <header className="blog-nav">
            <button type="button" className="blog-nav-logo" onClick={() => navigate('/about')} aria-label="GLKB">
                <img src={blogLogo} alt="GLKB" />
            </button>
            <div className="blog-nav-actions">
                <button type="button" className="blog-nav-link" onClick={() => navigate('/about')}>
                    Home
                </button>
                <button
                    type="button"
                    className={`blog-nav-link${active === 'blog' ? ' is-active' : ''}`}
                    onClick={() => navigate('/blog')}
                >
                    Our Blog
                </button>
                <button type="button" className="blog-nav-link" onClick={() => navigate('/about#data-dump')}>
                    License the Dataset
                </button>
                <button type="button" className="blog-nav-cta" onClick={() => navigate('/')}>
                    Get Started
                </button>
            </div>
        </header>
    );
};

export const BlogFooter = () => {
    const navigate = useNavigate();
    return (
        <>
            <section className="blog-footer-cta">
                <div className="blog-footer-cta-inner">
                    <h2 className="blog-footer-cta-title">Get Started</h2>
                    <p className="blog-footer-cta-sub">Start your literature review in minutes.</p>
                    <div className="blog-footer-cta-actions">
                        <button type="button" className="blog-nav-cta" onClick={() => navigate('/')}>
                            Try GLKB
                        </button>
                        <button type="button" className="blog-footer-secondary" onClick={() => navigate('/about')}>
                            View Demo
                        </button>
                    </div>
                </div>
            </section>
            <footer className="blog-footer">
                <div className="blog-footer-links">
                    <button type="button">Terms of Use</button>
                    <button type="button">Privacy Policy</button>
                    <button type="button">Contact Us</button>
                </div>
                <span>© 2026 Liu Lab</span>
            </footer>
        </>
    );
};

/** Figma 707:2812 — the card the Read Next row and the index page both use. */
export const BlogCard = ({ post, onOpen }) => (
    <button type="button" className="blog-card" onClick={() => onOpen(post.slug)}>
        <span className="blog-card-thumb">
            {post.thumb ? <img src={post.thumb} alt="" /> : null}
        </span>
        <span className="blog-card-title" title={post.title}>{post.title}</span>
        <span className="blog-card-excerpt">{post.excerpt}</span>
    </button>
);
