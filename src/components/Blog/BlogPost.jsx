import './scoped.css';

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

import { BLOG_LIST_PATH, BlogCard, BlogFooter, BlogNav } from './BlogChrome';
import { HEADING_ID } from './markdown';
import { getPost, IMAGES, posts } from './posts';

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

/** Flattened text of a hast node — headings carry no inline markup. */
const nodeText = (node) => (node?.children || [])
    .map((child) => (child.type === 'text' ? child.value : nodeText(child)))
    .join('');

/** `## Text {#anchor}` renders as a heading the rail can scroll to. */
const heading = (Tag, className) => function Heading({ node }) {
    const raw = nodeText(node);
    const match = HEADING_ID.exec(raw);
    return (
        <Tag className={className} id={match ? match[1] : undefined}>
            {match ? raw.slice(0, match.index) : raw}
        </Tag>
    );
};

/** An image alone in a paragraph is a figure, and its alt text the caption. */
const isLoneImage = (node) => {
    const children = (node?.children || [])
        .filter((child) => child.type !== 'text' || child.value.trim());
    return children.length === 1 && children[0].tagName === 'img' ? children[0] : null;
};

const Paragraph = function Paragraph({ node, children }) {
    const image = isLoneImage(node);
    if (!image) return <p className="blog-p">{children}</p>;

    const { src, alt } = image.properties;
    return (
        <figure className="blog-figure">
            {/* The plate is the bordered, filled box the design insets the image
                inside by 21 (714:2709) — the image itself carries no border. */}
            <span className="blog-figure-plate">
                {/* The design authors captions, not alt text, so the caption is the
                    alternative. The one uncaptioned figure gets alt="". */}
                <img src={IMAGES[src] || src} alt={alt || ''} loading="lazy" />
            </span>
            {alt ? <figcaption>{alt}</figcaption> : null}
        </figure>
    );
};

const articleComponents = {
    h2: heading('h2', 'blog-h2'),
    h3: heading('h3', 'blog-h3'),
    p: Paragraph,
    ul: function List({ children }) { return <ul className="blog-list">{children}</ul>; },
    table: function Table({ children }) {
        return (
            <div className="blog-table-wrap">
                <table className="blog-table">{children}</table>
            </div>
        );
    },
};

/** Inside the sample excerpt the paragraph styles differ from the article's. */
const sampleComponents = {
    h4: function SampleHeading({ children }) {
        return <p className="blog-sample-heading">{children}</p>;
    },
    p: function SampleText({ children }) {
        return <p className="blog-sample-text">{children}</p>;
    },
};

/** The label strips: one line of text in a div, so no paragraph wrapper. */
const bareComponents = {
    p: function Bare({ children }) { return <>{children}</>; },
};

const Markdown = ({ children, components }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
    </ReactMarkdown>
);

/** One segment of an article — see markdown.js for what the dialect allows. */
const Segment = ({ segment }) => {
    switch (segment.type) {
        case 'callout':
            return (
                <aside className="blog-callout">
                    <p className="blog-callout-title">{segment.title}</p>
                    <Markdown components={{ p: function CalloutText({ children }) {
                        return <p className="blog-callout-text">{children}</p>;
                    } }}
                    >
                        {segment.content}
                    </Markdown>
                </aside>
            );
        case 'sample':
            return (
                <div className="blog-sample">
                    <div className="blog-sample-label">{segment.label}</div>
                    {segment.note ? (
                        <div className="blog-sample-note">
                            <Markdown components={bareComponents}>{segment.note}</Markdown>
                        </div>
                    ) : null}
                    <div className="blog-sample-body">
                        <Markdown components={sampleComponents}>{segment.body}</Markdown>
                    </div>
                    {segment.footer ? (
                        <div className="blog-sample-footer">
                            <Markdown components={bareComponents}>{segment.footer}</Markdown>
                        </div>
                    ) : null}
                </div>
            );
        default:
            return <Markdown components={articleComponents}>{segment.content}</Markdown>;
    }
};

const BlogPost = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const post = getPost(slug);
    const [activeId, setActiveId] = useState('');

    // Figma declares the rail's groups explicitly and they do not follow the
    // body's h2/h3 nesting, so the markdown's front matter carries them.
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

    if (!post) return <Navigate to={BLOG_LIST_PATH} replace />;

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
                <meta name="description" content={post.lede} />
            </Helmet>

            <BlogNav active="blog" />

            <div className="blog-body">
                <nav className="blog-toc" aria-label="On this page">
                    <button type="button" className="blog-toc-brand" onClick={() => navigate(BLOG_LIST_PATH)}>
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
                        {post.segments.map((segment, index) => (
                            <Segment key={`${segment.type}-${index}`} segment={segment} />
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
