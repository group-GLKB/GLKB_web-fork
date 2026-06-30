import '../LLMAgent/github-markdown-light.css';
import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Mark from 'mark.js';
import ReactMarkdown from 'react-markdown';
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import logoIcon from '../../img/GLKB_logo_icon.png';
import {
  ReactComponent as CodeBlocksIcon,
} from '../../img/navbar/code_blocks.svg';
import logoWordmark from '../../img/navbar/logo.png';
import {
  DOCS_CATEGORIES,
  flattenDocsPages,
} from './docsConfig';
import OverviewLanding, {
  OVERVIEW_SEARCH_SECTIONS,
} from './pages/OverviewLanding';
import UseCaseGallery, { USE_CASE_SECTIONS } from './pages/UseCaseGallery';

const docsPages = flattenDocsPages(DOCS_CATEGORIES);
const firstPageSlug = docsPages[0]?.slug || 'overview';
const INFO_BOX_OPEN = '[[[glkb-info]]]';
const INFO_BOX_CLOSE = '[[[/glkb-info]]]';
const API_DOCS_RECENT_SEARCHES_KEY = 'glkb_api_docs_recent_searches';
const MAX_RECENT_SEARCHES = 6;

const slugifyHeading = (text) => text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';

const extractLevel2Headings = (source) => {
    if (!source) return [];

    const lines = source.split('\n');
    const headings = [];
    const usedIds = new Map();
    let inFence = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^```/.test(trimmed)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        const match = /^##\s+(.+?)\s*$/.exec(trimmed);
        if (!match) continue;

        const title = match[1].trim();
        const baseId = slugifyHeading(title);
        const count = usedIds.get(baseId) || 0;
        usedIds.set(baseId, count + 1);
        const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
        headings.push({ title, id });
    }

    return headings;
};

const splitMarkdownInfoBlocks = (source) => {
    if (!source) return [];

    const lines = source.split('\n');
    const blocks = [];
    let markdownBuffer = [];
    let infoBuffer = [];
    let infoTitle = '';
    let inInfoBlock = false;

    const flushMarkdown = () => {
        const content = markdownBuffer.join('\n').trim();
        if (content) blocks.push({ type: 'markdown', content });
        markdownBuffer = [];
    };

    const flushInfo = () => {
        const content = infoBuffer.join('\n').trim();
        if (content || infoTitle) blocks.push({ type: 'info', title: infoTitle, content });
        infoBuffer = [];
        infoTitle = '';
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const normalized = trimmed.toLowerCase();
        const infoOpenLower = INFO_BOX_OPEN.toLowerCase();
        const infoCloseLower = INFO_BOX_CLOSE.toLowerCase();

        if (!inInfoBlock && normalized.startsWith(infoOpenLower)) {
            flushMarkdown();
            infoTitle = trimmed.slice(INFO_BOX_OPEN.length).trim();
            inInfoBlock = true;
            continue;
        }
        if (inInfoBlock && normalized.startsWith(infoCloseLower)) {
            flushInfo();
            inInfoBlock = false;
            continue;
        }

        if (inInfoBlock) {
            infoBuffer.push(line);
        } else {
            markdownBuffer.push(line);
        }
    }

    // Fail-safe: unmatched marker falls back to normal markdown content.
    if (inInfoBlock) {
        const fallbackOpen = infoTitle ? `${INFO_BOX_OPEN}${infoTitle}` : INFO_BOX_OPEN;
        markdownBuffer.push(fallbackOpen, ...infoBuffer);
    }
    flushMarkdown();

    return blocks;
};

const extractTextContent = (node) => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractTextContent).join('');
    if (React.isValidElement(node)) return extractTextContent(node.props?.children);
    return '';
};

const normalizeHeadingLabel = (text) => text
    .replace(/`+/g, '')
    .trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripMarkdownFormatting = (line) => line
    .replace(/\[\[\[\/?glkb-info\]\]\]/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildSnippet = (text, start, keywordLength) => {
    const radius = 56;
    const snippetStart = Math.max(0, start - radius);
    const snippetEnd = Math.min(text.length, start + keywordLength + radius);
    const prefix = snippetStart > 0 ? '...' : '';
    const suffix = snippetEnd < text.length ? '...' : '';
    return `${prefix}${text.slice(snippetStart, snippetEnd).trim()}${suffix}`;
};

const renderHighlightedSnippet = (snippet, query) => {
    if (!query) return snippet;
    const parts = snippet.split(new RegExp(`(${escapeRegExp(query)})`, 'ig'));
    return parts.map((part, index) => (
        part.toLowerCase() === query.toLowerCase()
            ? <mark key={`${part}-${index}`}>{part}</mark>
            : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ));
};

const resolveMarkdownAssetUrl = (assetPath = '') => {
    if (!assetPath || typeof assetPath !== 'string') return '';
    if (/^(https?:)?\/\//i.test(assetPath) || assetPath.startsWith('data:') || assetPath.startsWith('blob:')) {
        return assetPath;
    }

    const normalizedAssetPath = assetPath.replace(/^\.\//, '').replace(/^\/+/, '');
    const publicUrl = process.env.PUBLIC_URL || '';
    const normalizedPublicBase = publicUrl === '.'
        ? ''
        : publicUrl.replace(/\/+$/, '').replace(/^\/+/, '');
    const basePath = normalizedPublicBase ? `/${normalizedPublicBase}` : '';

    return `${window.location.origin}${basePath}/${normalizedAssetPath}`;
};

const CodeBlockRenderer = ({ className, children, ...props }) => {
    const [copied, setCopied] = useState(false);
    const childArray = React.Children.toArray(children);
    const codeElement = childArray.find((child) => React.isValidElement(child) && child.type === 'code');
    const codeClassName = codeElement?.props?.className || '';
    const languageMatch = codeClassName.match(/language-([\w#+-]+)/i);
    const language = languageMatch?.[1] || '';
    const codeText = extractTextContent(codeElement?.props?.children ?? children);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="api-docs-code-block-shell">
            {language ? (
                <div className="api-docs-code-block-header">
                    <span className="api-docs-code-block-language">{language}</span>
                    <button
                        type="button"
                        className="api-docs-code-copy-btn"
                        onClick={handleCopy}
                        aria-label={copied ? 'Copied' : 'Copy code'}
                        title={copied ? 'Copied' : 'Copy code'}
                    >
                        <ContentCopyIcon fontSize="inherit" />
                    </button>
                </div>
            ) : null}
            {!language ? (
                <button
                    type="button"
                    className="api-docs-code-copy-btn floating"
                    onClick={handleCopy}
                    aria-label={copied ? 'Copied' : 'Copy code'}
                    title={copied ? 'Copied' : 'Copy code'}
                >
                    <ContentCopyIcon fontSize="inherit" />
                </button>
            ) : null}
            <pre className={`api-docs-code-block${className ? ` ${className}` : ''}`} {...props}>
                {children}
            </pre>
        </div>
    );
};

const markdownComponents = {
    pre: CodeBlockRenderer,
};

const ApiDocsPage = () => {
    const navigate = useNavigate();
    const { slug } = useParams();
    const contentPaneRef = useRef(null);
    const searchWrapRef = useRef(null);
    const searchDialogRef = useRef(null);
    const searchInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sidebarSearchText, setSidebarSearchText] = useState('');
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            const raw = window.localStorage.getItem(API_DOCS_RECENT_SEARCHES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.filter((item) => typeof item === 'string' && item.trim()).slice(0, MAX_RECENT_SEARCHES)
                : [];
        } catch {
            return [];
        }
    });
    const [searchBlocks, setSearchBlocks] = useState([]);
    const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
    const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
    const [pendingSearchJump, setPendingSearchJump] = useState(null);
    const [markdownContent, setMarkdownContent] = useState('');
    const [activeHeadingId, setActiveHeadingId] = useState('');
    const [indexMenuOpen, setIndexMenuOpen] = useState(false);
    const indexMenuTimersRef = useRef({ open: null, close: null });

    const activeSlug = slug || firstPageSlug;

    const activePage = useMemo(
        () => docsPages.find((page) => page.slug === activeSlug) || docsPages[0],
        [activeSlug]
    );
    const isOverviewLanding = activePage?.layout === 'overview-landing';
    const isUseCaseGallery = activePage?.layout === 'use-case-gallery';
    const isMarkdownPage = !isOverviewLanding && !isUseCaseGallery;

    const filteredCategories = DOCS_CATEGORIES;
    const categoryLabelBySlug = useMemo(() => {
        const map = new Map();
        DOCS_CATEGORIES.forEach((category) => {
            category.pages.forEach((page) => {
                map.set(page.slug, category.label);
            });
        });
        return map;
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(API_DOCS_RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
        } catch {
            // Ignore quota/privacy mode write failures.
        }
    }, [recentSearches]);

    const searchResults = useMemo(() => {
        const query = searchTerm.trim();
        if (query.length < 2) return [];

        const queryLower = query.toLowerCase();
        const results = [];

        searchBlocks.forEach((block) => {
            const lowerText = block.text.toLowerCase();
            let startIndex = 0;
            while (startIndex < lowerText.length) {
                const foundAt = lowerText.indexOf(queryLower, startIndex);
                if (foundAt === -1) break;

                results.push({
                    id: `${block.id}-${foundAt}`,
                    slug: block.slug,
                    pageTitle: block.pageTitle,
                    heading: block.heading,
                    anchorId: block.anchorId,
                    snippet: buildSnippet(block.text, foundAt, query.length),
                });

                startIndex = foundAt + query.length;
                if (results.length >= 60) break;
            }
        });

        return results.slice(0, 40);
    }, [searchBlocks, searchTerm]);

    const parsedMarkdownBlocks = useMemo(
        () => splitMarkdownInfoBlocks(markdownContent),
        [markdownContent]
    );

    const tocHeadings = useMemo(
        () => extractLevel2Headings(markdownContent),
        [markdownContent]
    );

    const activeHeadingIndex = useMemo(() => {
        const idx = tocHeadings.findIndex((item) => item.id === activeHeadingId);
        return idx >= 0 ? idx : 0;
    }, [tocHeadings, activeHeadingId]);

    const markdownComponents = useMemo(() => {
        let headingCursor = 0;

        return {
            pre: CodeBlockRenderer,
            h2({ children, ...props }) {
                const title = extractTextContent(children).trim();
                const mappedHeading = tocHeadings[headingCursor];
                const id = mappedHeading ? mappedHeading.id : slugifyHeading(title);
                headingCursor += 1;
                return <h2 id={id} {...props}>{children}</h2>;
            },
        };
    }, [tocHeadings]);

    useEffect(() => {
        let isAlive = true;

        const buildSearchIndex = async () => {
            const blocks = [];

            for (const page of docsPages) {
                const baseId = `${page.slug}-top`;
                const fallbackText = [page.title, page.description].filter(Boolean).join(' - ');

                if (fallbackText) {
                    blocks.push({
                        id: baseId,
                        slug: page.slug,
                        pageTitle: page.title,
                        heading: page.title,
                        anchorId: '',
                        text: fallbackText,
                    });
                }

                if (page.layout === 'overview-landing') {
                    OVERVIEW_SEARCH_SECTIONS.forEach((section, index) => {
                        blocks.push({
                            id: `${page.slug}-${section.anchorId || 'top'}-${index}`,
                            slug: page.slug,
                            pageTitle: page.title,
                            heading: section.heading,
                            anchorId: section.anchorId || '',
                            text: stripMarkdownFormatting(section.text || ''),
                        });
                    });
                    continue;
                }

                if (page.layout === 'use-case-gallery') {
                    USE_CASE_SECTIONS.forEach((section, sectionIndex) => {
                        const sectionText = stripMarkdownFormatting(section.title || '');
                        if (sectionText) {
                            blocks.push({
                                id: `${page.slug}-${section.id}-heading-${sectionIndex}`,
                                slug: page.slug,
                                pageTitle: page.title,
                                heading: section.title,
                                anchorId: '',
                                text: sectionText,
                            });
                        }

                        section.entries.forEach((entry) => {
                            const combined = stripMarkdownFormatting([
                                entry.title,
                                entry.audience,
                                entry.description,
                                entry.prompt,
                            ].filter(Boolean).join(' '));
                            if (!combined) return;

                            blocks.push({
                                id: `${page.slug}-use-case-${entry.id}`,
                                slug: page.slug,
                                pageTitle: page.title,
                                heading: `${entry.id}. ${entry.title}`,
                                anchorId: `use-case-${entry.id}`,
                                text: combined,
                            });
                        });
                    });
                    continue;
                }

                let source = '';
                if (page.markdownInline) {
                    source = page.markdownInline;
                } else if (page.markdown) {
                    try {
                        const response = await fetch(resolveMarkdownAssetUrl(page.markdown));
                        source = await response.text();
                    } catch {
                        source = '';
                    }
                }
                if (!source) continue;

                const lines = source.split('\n');
                let inFence = false;
                let currentHeading = page.title;
                let currentAnchor = '';

                lines.forEach((line, lineIndex) => {
                    const trimmed = line.trim();
                    const normalized = trimmed.toLowerCase();

                    if (/^```/.test(trimmed)) {
                        inFence = !inFence;
                        return;
                    }
                    if (inFence || !trimmed) return;

                    if (normalized.startsWith(INFO_BOX_OPEN.toLowerCase()) || normalized.startsWith(INFO_BOX_CLOSE.toLowerCase())) {
                        return;
                    }

                    const headingMatch = /^(#{2,6})\s+(.+?)\s*$/.exec(trimmed);
                    if (headingMatch) {
                        currentHeading = headingMatch[2].trim();
                        currentAnchor = slugifyHeading(currentHeading);
                        return;
                    }

                    if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed)) {
                        return;
                    }

                    const cleaned = stripMarkdownFormatting(trimmed);
                    if (!cleaned || cleaned.length < 2) return;

                    blocks.push({
                        id: `${page.slug}-${currentAnchor || 'top'}-${lineIndex}`,
                        slug: page.slug,
                        pageTitle: page.title,
                        heading: currentHeading,
                        anchorId: currentAnchor,
                        text: cleaned,
                    });
                });
            }

            if (isAlive) {
                setSearchBlocks(blocks);
            }
        };

        buildSearchIndex();
        return () => {
            isAlive = false;
        };
    }, []);

    useEffect(() => {
        if (!isMarkdownPage || tocHeadings.length === 0) {
            setActiveHeadingId('');
            return;
        }

        setActiveHeadingId(tocHeadings[0].id);
    }, [isMarkdownPage, tocHeadings, activeSlug]);

    const openIndexMenuWithDelay = () => {
        if (indexMenuTimersRef.current.close) {
            clearTimeout(indexMenuTimersRef.current.close);
            indexMenuTimersRef.current.close = null;
        }
        if (indexMenuOpen) return;
        if (!indexMenuTimersRef.current.open) {
            indexMenuTimersRef.current.open = setTimeout(() => {
                setIndexMenuOpen(true);
                indexMenuTimersRef.current.open = null;
            }, 140);
        }
    };

    const closeIndexMenuWithDelay = () => {
        if (indexMenuTimersRef.current.open) {
            clearTimeout(indexMenuTimersRef.current.open);
            indexMenuTimersRef.current.open = null;
        }
        if (!indexMenuOpen) return;
        if (!indexMenuTimersRef.current.close) {
            indexMenuTimersRef.current.close = setTimeout(() => {
                setIndexMenuOpen(false);
                indexMenuTimersRef.current.close = null;
            }, 260);
        }
    };

    useEffect(() => () => {
        if (indexMenuTimersRef.current.open) clearTimeout(indexMenuTimersRef.current.open);
        if (indexMenuTimersRef.current.close) clearTimeout(indexMenuTimersRef.current.close);
    }, []);

    useEffect(() => {
        if (!searchOverlayOpen) return;

        const handleOutsideClick = (event) => {
            if (!searchDialogRef.current?.contains(event.target)) {
                closeSearchOverlay();
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeSearchOverlay();
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [searchOverlayOpen, searchTerm, searchResults.length]);

    useEffect(() => {
        if (!searchOverlayOpen) return undefined;
        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [searchOverlayOpen]);

    useEffect(() => {
        if (!searchOverlayOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [searchOverlayOpen]);

    const highlightKeywordInContent = (keyword) => {
        const container = contentPaneRef.current?.querySelector('.api-docs-content');
        if (!container) return;
        const marker = new Mark(container);

        marker.unmark({
            done: () => {
                if (!keyword) return;
                marker.mark(keyword, {
                    separateWordSearch: false,
                    className: 'api-docs-search-mark',
                });
            },
        });
    };

    const scrollToAnchor = (anchorId) => {
        if (anchorId) {
            const target = document.getElementById(anchorId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        if (contentPaneRef.current) {
            contentPaneRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSearchResultClick = (result) => {
        const keyword = searchTerm.trim();
        if (keyword) {
            setRecentSearches((prev) => {
                const deduped = prev.filter((item) => item.toLowerCase() !== keyword.toLowerCase());
                return [keyword, ...deduped].slice(0, MAX_RECENT_SEARCHES);
            });
        }
        setSearchTerm('');
        setSidebarSearchText('');
        setSearchOverlayOpen(false);
        setSearchDropdownOpen(false);
        setPendingSearchJump({
            slug: result.slug,
            anchorId: result.anchorId,
            keyword,
        });

        if (result.slug !== activeSlug) {
            navigate(`/api-docs/${result.slug}`);
        } else {
            scrollToAnchor(result.anchorId);
            highlightKeywordInContent(keyword);
        }
    };

    useEffect(() => {
        if (!isMarkdownPage || tocHeadings.length === 0) return;

        const container = contentPaneRef.current;
        if (!container) return;

        const syncActiveHeading = () => {
            const threshold = 140;

            let currentId = tocHeadings[0].id;

            for (const heading of tocHeadings) {
                const element = document.getElementById(heading.id);
                if (!element) continue;
                const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
                if (top <= threshold) {
                    currentId = heading.id;
                }
            }

            setActiveHeadingId(currentId);
        };

        syncActiveHeading();
        container.addEventListener('scroll', syncActiveHeading);
        return () => container.removeEventListener('scroll', syncActiveHeading);
    }, [isMarkdownPage, tocHeadings, markdownContent]);

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
        fetch(resolveMarkdownAssetUrl(activePage.markdown))
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

    useEffect(() => {
        if (!pendingSearchJump || pendingSearchJump.slug !== activeSlug) return;

        const timer = window.setTimeout(() => {
            scrollToAnchor(pendingSearchJump.anchorId);
            highlightKeywordInContent(pendingSearchJump.keyword);
            setPendingSearchJump(null);
        }, 80);

        return () => window.clearTimeout(timer);
    }, [activeSlug, markdownContent, pendingSearchJump]);

    useEffect(() => {
        if (searchTerm.trim()) return;
        highlightKeywordInContent('');
    }, [searchTerm]);

    const openSearchOverlay = () => {
        setSearchOverlayOpen(true);
        setSearchDropdownOpen(true);
    };

    const closeSearchOverlay = () => {
        const keyword = searchTerm.trim();
        setSidebarSearchText(keyword);
        setSearchOverlayOpen(false);
        setSearchDropdownOpen(false);
    };

    const clearSearchInput = () => {
        setSearchTerm('');
        setSidebarSearchText('');
        setSearchDropdownOpen(true);
        searchInputRef.current?.focus();
    };

    const handleRecentSearchClick = (term) => {
        setSearchTerm(term);
        setSearchDropdownOpen(true);
        searchInputRef.current?.focus();
    };

    const showSearchResults = searchDropdownOpen && searchTerm.trim().length >= 2;
    const showRecentSearches = searchDropdownOpen && searchTerm.trim().length < 2 && recentSearches.length > 0;
    const showSearchPanel = showSearchResults || showRecentSearches;

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
                    <CodeBlocksIcon className="api-docs-jump-btn-icon" aria-hidden="true" />
                    <span>API Page</span>
                </button>
            </header>

            <main className="api-docs-main">
                <aside className="api-docs-sidebar">
                    <div ref={searchWrapRef} className="api-docs-search-wrap">
                        <button
                            type="button"
                            className="api-docs-search-trigger"
                            aria-label="Open docs search"
                            onClick={openSearchOverlay}
                        >
                            <SearchRoundedIcon className="api-docs-search-trigger-icon" aria-hidden="true" />
                            <span className="api-docs-search-trigger-placeholder">{sidebarSearchText || 'Search anything...'}</span>
                        </button>
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

                <section
                    ref={contentPaneRef}
                    className={`api-docs-content-pane${isOverviewLanding || isUseCaseGallery ? ' with-overview-rail' : ''}${isMarkdownPage ? ' with-index-rail' : ''}`}
                >
                    {isOverviewLanding ? (
                        <OverviewLanding navigate={navigate} />
                    ) : isUseCaseGallery ? (
                        <UseCaseGallery navigate={navigate} />
                    ) : (
                        <>
                            <div className="api-docs-markdown-wrap">
                                <article className="api-docs-content markdown-body">
                                    {parsedMarkdownBlocks.map((block, index) => {
                                        if (block.type === 'info') {
                                            return (
                                                <div key={`info-${index}`} className="api-docs-info-box">
                                                    <div className="api-docs-info-box-icon" aria-hidden="true">
                                                        <InfoOutlinedIcon fontSize="inherit" />
                                                    </div>
                                                    <div className="api-docs-info-box-body">
                                                        <h4 className="api-docs-info-box-title">{block.title || 'Info'}</h4>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={markdownComponents}
                                                        >
                                                            {block.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <ReactMarkdown
                                                key={`md-${index}`}
                                                remarkPlugins={[remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {block.content}
                                            </ReactMarkdown>
                                        );
                                    })}

                                    {(activePage?.htmlBlocks || []).map((block, index) => (
                                        <div
                                            key={`${activePage.slug}-html-${index}`}
                                            className="api-docs-html-block"
                                            dangerouslySetInnerHTML={{ __html: block }}
                                        />
                                    ))}
                                </article>
                            </div>

                            <aside className="api-docs-index-rail" aria-label="Page index">
                                {tocHeadings.length > 1 ? (
                                    <div
                                        className="api-docs-index-hover-wrap"
                                        onMouseEnter={openIndexMenuWithDelay}
                                        onMouseLeave={closeIndexMenuWithDelay}
                                    >
                                        <nav className={`api-docs-index-menu${indexMenuOpen ? ' visible' : ''}`}>
                                            {tocHeadings.map((heading) => {
                                                const isActive = heading.id === activeHeadingId;
                                                const headingLabel = normalizeHeadingLabel(heading.title);
                                                return (
                                                    <button
                                                        key={heading.id}
                                                        type="button"
                                                        className={`api-docs-index-menu-item${isActive ? ' active' : ''}`}
                                                        title={headingLabel}
                                                        aria-label={headingLabel}
                                                        onClick={() => {
                                                            const target = document.getElementById(heading.id);
                                                            if (target) {
                                                                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                            }
                                                        }}
                                                    >
                                                        <span className="api-docs-index-menu-item-label">{headingLabel}</span>
                                                    </button>
                                                );
                                            })}
                                        </nav>

                                        <button
                                            type="button"
                                            className="api-docs-index-compact"
                                            aria-label={`Section ${activeHeadingIndex + 1} of ${tocHeadings.length}`}
                                        >
                                            <div className="api-docs-index-compact-bars" aria-hidden="true">
                                                {tocHeadings.map((item, idx) => (
                                                    <span
                                                        key={item.id}
                                                        className={`api-docs-index-compact-bar${idx === activeHeadingIndex ? ' active' : ''}`}
                                                    />
                                                ))}
                                            </div>
                                        </button>
                                    </div>
                                ) : null}
                            </aside>
                        </>
                    )}
                </section>
            </main>

            {searchOverlayOpen ? (
                <div className="api-docs-search-overlay" role="presentation">
                    <div
                        ref={searchDialogRef}
                        className={`api-docs-search-dialog${showSearchPanel ? ' has-panel' : ''}`}
                    >
                        <div className="api-docs-search-input-shell">
                            <SearchRoundedIcon className="api-docs-search-input-icon" aria-hidden="true" />
                            <input
                                ref={searchInputRef}
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                onFocus={() => setSearchDropdownOpen(true)}
                                placeholder="Search anything..."
                                aria-label="Search API docs"
                                className="api-docs-search-input"
                            />
                            <button
                                type="button"
                                className="api-docs-search-close-btn"
                                onClick={clearSearchInput}
                                aria-label="Clear search input"
                            >
                                <CloseRoundedIcon fontSize="inherit" />
                            </button>
                        </div>

                        {showSearchResults ? (
                            <div className="api-docs-search-results" role="listbox" aria-label="Search results">
                                {searchResults.length === 0 ? (
                                    <p className="api-docs-search-empty">No content matches found.</p>
                                ) : (
                                    searchResults.map((result) => (
                                        <button
                                            key={result.id}
                                            type="button"
                                            className="api-docs-search-result-item"
                                            onClick={() => handleSearchResultClick(result)}
                                        >
                                            <span className="api-docs-search-result-page">
                                                <span>{categoryLabelBySlug.get(result.slug) || 'Docs'}</span>
                                            </span>
                                            <span className="api-docs-search-result-heading">{result.pageTitle}</span>
                                            <span className="api-docs-search-result-snippet">
                                                {renderHighlightedSnippet(result.snippet, searchTerm.trim())}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}

                        {showRecentSearches ? (
                            <div className="api-docs-search-recent" role="listbox" aria-label="Recent searches">
                                <p className="api-docs-search-recent-title">Recent searches</p>
                                <div className="api-docs-search-recent-list">
                                    {recentSearches.map((term) => (
                                        <button
                                            key={term}
                                            type="button"
                                            className="api-docs-search-recent-item"
                                            onClick={() => handleRecentSearchClick(term)}
                                        >
                                            <SearchRoundedIcon className="api-docs-search-recent-icon" aria-hidden="true" />
                                            <span>{term}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ApiDocsPage;
