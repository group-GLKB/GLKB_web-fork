import './scoped.css';

import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { BlogCard, BlogFooter, BlogNav } from './BlogChrome';
import { posts } from './posts';

/** The listing page: every post as the card the article's Read Next row uses. */
const BlogIndex = () => {
    const navigate = useNavigate();

    // Same scroller as the article — see BlogPost's note.
    useEffect(() => {
        let el = document.querySelector('.blog-page')?.parentElement;
        while (el && el !== document.body) {
            const { overflowY } = window.getComputedStyle(el);
            if (overflowY === 'auto' || overflowY === 'scroll') { el.scrollTop = 0; return; }
            el = el.parentElement;
        }
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="blog-page">
            <Helmet>
                <title>Our Blog | GLKB</title>
                <meta
                    name="description"
                    content="Writing from the Liu Lab on the GLKB knowledge graph and the Investigate research agent."
                />
            </Helmet>

            <BlogNav active="blog" />

            <section className="blog-index-head">
                <div className="blog-index-head-inner">
                    <h1 className="blog-index-title">GLKB Blog</h1>
                    <p className="blog-index-sub">
                        How the knowledge graph is built, and what gets built on top of it.
                    </p>
                </div>
            </section>

            <section className="blog-index-list">
                <div className="blog-index-list-inner">
                    <div className="blog-card-grid">
                        {posts.map((post) => (
                            <BlogCard
                                key={post.slug}
                                post={post}
                                onOpen={(slug) => navigate(`/blog/${slug}`)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <BlogFooter />
        </div>
    );
};

export default BlogIndex;
