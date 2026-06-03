import '../LLMAgent/github-markdown-light.css';
import './scoped.css';

import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Link,
    useNavigate,
    useParams,
} from 'react-router-dom';

import logoIcon from '../../img/GLKB_logo_icon.png';
import logoWordmark from '../../img/navbar/logo.jpg';
import {
    DOCS_CATEGORIES,
    flattenDocsPages,
} from './docsConfig';
import OverviewLanding from './pages/OverviewLanding';
import UseCaseGallery from './pages/UseCaseGallery';

const docsPages = flattenDocsPages(DOCS_CATEGORIES);
const firstPageSlug = docsPages[0]?.slug || 'overview';

const ApiDocsPage = () => {
    const navigate = useNavigate();
    const { slug } = useParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [markdownContent, setMarkdownContent] = useState('');

    const activeSlug = slug || firstPageSlug;

    const activePage = useMemo(
        () => docsPages.find((page) => page.slug === activeSlug) || docsPages[0],
        [activeSlug]
    );
    const isOverviewLanding = activePage?.layout === 'overview-landing';
    const isUseCaseGallery = activePage?.layout === 'use-case-gallery';

    const filteredCategories = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return DOCS_CATEGORIES;

        return DOCS_CATEGORIES
            .map((category) => ({
                ...category,
                pages: category.pages.filter((page) => {
                    const inTitle = page.title.toLowerCase().includes(keyword);
                    const inDesc = (page.description || '').toLowerCase().includes(keyword);
                    return inTitle || inDesc;
                }),
            }))
            .filter((category) => category.pages.length > 0);
    }, [searchTerm]);

    useEffect(() => {
        if (!activePage) return;

        document.title = `${activePage.title} | API Docs | GLKB`;

        if (activePage.layout === 'overview-landing' || activePage.layout === 'use-case-gallery') {
            setMarkdownContent('');
            return;
        }

        if (activePage.markdownInline) {
            setMarkdownContent(activePage.markdownInline);
            return;
        }

        if (!activePage.markdown) {
            setMarkdownContent('# Coming Soon\n\nContent has not been added yet.');
            return;
        }

        let isAlive = true;
        fetch(activePage.markdown)
            .then((response) => response.text())
            .then((text) => {
                if (isAlive) setMarkdownContent(text);
            })
            .catch(() => {
                if (isAlive) {
                    setMarkdownContent('# Load Error\n\nFailed to load markdown content for this page.');
                }
            });

        return () => {
            isAlive = false;
        };
    }, [activePage]);

    useEffect(() => {
        if (!slug) {
            navigate(`/api-docs/${firstPageSlug}`, { replace: true });
        }
    }, [navigate, slug]);

    return (
        <div className="api-docs-page-root">
            <header className="api-docs-header">
                <div className="api-docs-header-brand">
                    <Link to="/" className="api-docs-logo-link" aria-label="GLKB Home">
                        <img src={logoIcon} alt="GLKB icon" className="api-docs-logo-icon" />
                        <img src={logoWordmark} alt="GLKB" className="api-docs-logo" />
                    </Link>
                    <span className="api-docs-header-title">API Docs</span>
                </div>
                <button
                    type="button"
                    className="api-docs-jump-btn"
                    onClick={() => navigate('/api-page')}
                >
                    API Page
                </button>
            </header>

            <main className="api-docs-main">
                <aside className="api-docs-sidebar">
                    <div className="api-docs-search-wrap">
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search docs..."
                            aria-label="Search API docs"
                            className="api-docs-search-input"
                        />
                    </div>

                    <div className="api-docs-sidebar-groups">
                        {filteredCategories.length === 0 ? (
                            <p className="api-docs-empty">No matching pages</p>
                        ) : (
                            filteredCategories.map((category) => (
                                <section key={category.id} className="api-docs-group">
                                    <h3 className="api-docs-group-title">{category.label}</h3>
                                    <div className="api-docs-group-items">
                                        {category.pages.map((page) => {
                                            const isActive = page.slug === activePage?.slug;
                                            return (
                                                <button
                                                    key={page.slug}
                                                    type="button"
                                                    className={`api-docs-nav-item${isActive ? ' active' : ''}`}
                                                    onClick={() => navigate(`/api-docs/${page.slug}`)}
                                                >
                                                    {page.title}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))
                        )}
                    </div>
                </aside>

                <section className={`api-docs-content-pane${isOverviewLanding || isUseCaseGallery ? ' with-overview-rail' : ''}`}>
                    {isOverviewLanding ? (
                        <OverviewLanding navigate={navigate} />
                    ) : isUseCaseGallery ? (
                        <UseCaseGallery navigate={navigate} />
                    ) : (
                        <article className="api-docs-content markdown-body">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code({ inline, className, children, ...props }) {
                                        if (inline) {
                                            return (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return (
                                            <pre className="api-docs-code-block">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        );
                                    },
                                }}
                            >
                                {markdownContent}
                            </ReactMarkdown>

                            {(activePage?.htmlBlocks || []).map((block, index) => (
                                <div
                                    key={`${activePage.slug}-html-${index}`}
                                    className="api-docs-html-block"
                                    dangerouslySetInnerHTML={{ __html: block }}
                                />
                            ))}
                        </article>
                    )}
                </section>
            </main>
        </div>
    );
};

export default ApiDocsPage;
