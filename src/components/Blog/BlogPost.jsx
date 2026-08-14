import './scoped.css';

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

import { BlogCard, BlogFooter, BlogNav } from './BlogChrome';
import { getPost, posts } from './posts';

/** The nearest scrolling ancestor, or the window if nothing else scrolls. */
const findScrollParent = (node) => {
    let el = node?.parentElement;
    while (el && el !== document.body) {
        const { overflowY } = window.getComputedStyle(el);
        // Deliberately not gated on scrollHeight > clientHeight: on mount the
        // images have not loaded, the wrapper is not yet overflowing, and the
        // listener would silently attach to a window that never scrolls.
        if (overflowY === 'auto' || overflowY === 'scroll') return el;
        el = el.parentElement;
    }
    return window;
};

/** One content block. The kinds are documented on posts.js. */
const Block = ({ block }) => {
    switch (block.kind) {
        case 'h2':
            return <h2 className="blog-h2" id={block.id}>{block.text}</h2>;
        case 'h3':
            return <h3 className="blog-h3" id={block.id}>{block.text}</h3>;
        case 'p':
            return <p className="blog-p">{block.text}</p>;
        case 'figure':
            return (
                <figure className="blog-figure">
                    <img src={block.src} alt={block.alt} loading="lazy" />
                    {block.caption ? <figcaption>{block.caption}</figcaption> : null}
                </figure>
            );
        case 'table':
            return (
                <div className="blog-table-wrap">
                    <table className="blog-table">
                        <thead>
                            <tr>{block.head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row) => (
                                <tr key={row.join('|')}>
                                    {row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case 'callout':
            return (
                <aside className="blog-callout">
                    <p className="blog-callout-title">{block.title}</p>
                    <p className="blog-callout-text">{block.text}</p>
                </aside>
            );
        case 'list':
            return (
                <ul className="blog-list">
                    {block.items.map(([lead, rest]) => (
                        <li key={lead}><strong>{lead}</strong> {rest}</li>
                    ))}
                </ul>
            );
        case 'sample':
            return (
                <div className="blog-sample">
                    <div className="blog-sample-label">{block.label}</div>
                    {block.note ? <div className="blog-sample-note">{block.note}</div> : null}
                    <div className="blog-sample-body">
                        {block.sections.map((section, index) => (
                            <React.Fragment key={section.heading || `s-${index}`}>
                                {section.heading
                                    ? <p className="blog-sample-heading">{section.heading}</p>
                                    : null}
                                <p className="blog-sample-text">{section.body}</p>
                            </React.Fragment>
                        ))}
                    </div>
                    {block.footer ? <div className="blog-sample-footer">{block.footer}</div> : null}
                </div>
            );
        default:
            return null;
    }
};

const BlogPost = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const post = getPost(slug);
    const [activeId, setActiveId] = useState('');

    // Figma declares the rail's groups explicitly (data-name="ToC Group …"), and
    // they do not follow the body's h2/h3 nesting, so posts.js carries them.
    const tocGroups = useMemo(() => (post?.toc ? post.toc : []), [post]);
    const tocItems = useMemo(() => tocGroups.flat(), [tocGroups]);

    // AppLayout scrolls an inner wrapper rather than the window, so both the
    // reset and the scroll-spy have to attach to that element — on the window
    // they silently never fire.
    useEffect(() => {
        const scroller = findScrollParent(document.querySelector('.blog-page'));
        if (scroller === window) window.scrollTo(0, 0);
        else if (scroller) scroller.scrollTop = 0;
    }, [slug]);

    // Highlight whichever section heading is nearest the top of the viewport.
    useEffect(() => {
        if (!tocItems.length) return undefined;
        const scroller = findScrollParent(document.querySelector('.blog-page'));
        if (!scroller) return undefined;
        const onScroll = () => {
            let current = '';
            tocItems.forEach((item) => {
                const el = document.getElementById(item.id);
                if (el && el.getBoundingClientRect().top <= 120) current = item.id;
            });
            setActiveId(current);
        };

        onScroll();
        scroller.addEventListener('scroll', onScroll, { passive: true });
        return () => scroller.removeEventListener('scroll', onScroll);
    }, [tocItems]);

    if (!post) return <Navigate to="/blog" replace />;

    // Labels that name a passage rather than a heading land on their group's anchor.
    const scrollToSection = (id, fallbackId) => {
        const target = document.getElementById(id) || document.getElementById(fallbackId);
        target?.scrollIntoView({ behavior: 'smooth' });
    };

    const next = posts.find((entry) => entry.slug === post.readNext);
    const openPost = (nextSlug) => navigate(`/blog/${nextSlug}`);

    return (
        <div className="blog-page">
            <Helmet>
                <title>{`${post.title} | GLKB`}</title>
                <meta name="description" content={post.excerpt} />
            </Helmet>

            <BlogNav active="blog" />

            <div className="blog-body">
                <nav className="blog-toc" aria-label="On this page">
                    <button type="button" className="blog-toc-brand" onClick={() => navigate('/blog')}>
                        <ChevronLeftIcon className="blog-toc-brand-icon" />
                        GLKB Blog
                    </button>
                    {tocGroups.map((group) => (
                        <div className="blog-toc-group" key={group[0].id}>
                            {group.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={
                                        `blog-toc-link${item.child ? ' is-child' : ''}`
                                        + `${activeId === item.id ? ' is-active' : ''}`
                                    }
                                    onClick={() => scrollToSection(item.id, group[0].id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="blog-content">
                    <header className="blog-hero">
                        <div className="blog-meta">
                            <span>{post.kicker}</span>
                            <span>{post.date}</span>
                        </div>
                        <h1 className="blog-title">{post.title}</h1>
                        <p className="blog-lede">{post.lede}</p>
                        <button
                            type="button"
                            className="blog-hero-cta"
                            onClick={() => navigate(post.cta.to)}
                        >
                            {post.cta.label}
                        </button>
                    </header>

                    <article className="blog-article">
                        {post.blocks.map((block, index) => (
                            <Block key={`${block.kind}-${block.id || block.text || index}`} block={block} />
                        ))}
                    </article>
                </div>
            </div>

            {next && (
                <section className="blog-read-next">
                    <div className="blog-read-next-inner">
                        <h2 className="blog-read-next-title">Read Next</h2>
                        <div className="blog-card-grid">
                            <BlogCard post={next} onOpen={openPost} />
                        </div>
                    </div>
                </section>
            )}

            <BlogFooter />
        </div>
    );
};

export default BlogPost;
