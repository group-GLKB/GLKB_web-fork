import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';

import formatQuoteIcon from '../../../img/llm/format_quote.svg';
import {
  fetchBookmarks,
  getBookmarks,
  toggleBookmark,
} from '../../../utils/bookmarks';
import { useAuth } from '../../Auth/AuthContext';
import './scoped.css';

const ReferenceCard = ({
    url,
    evidence = [],
    sourceHid = null,
    handleClick,
    onCiteClick,
    isHighlighted = false,
    index = null,
    showCitations = true,
}) => {
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
    const [isQuoteTruncated, setIsQuoteTruncated] = useState(false);
    const quoteTextRef = useRef(null);
    const { isAuthenticated, loading, openLoginModal } = useAuth();
    const navigate = useNavigate();
    const showHighlight = isHighlighted;

    const pubmedId = useMemo(() => {
        const urlValue = url?.[1] || '';
        const parts = urlValue.split('/').filter(Boolean);
        return parts[parts.length - 1] || urlValue;
    }, [url]);

    const handleCiteClick = (event) => {
        event.stopPropagation();
        if (onCiteClick) {
            onCiteClick(url);
        }
    };

    const handleBookmarkClick = async (event) => {
        event.stopPropagation();
        if (loading) return;
        if (!isAuthenticated) {
            openLoginModal();
            return;
        }
        const entry = {
            id: pubmedId,
            title: url?.[0] || '',
            url: url?.[1] || '',
            citation_count: url?.[2] || 0,
            year: url?.[3] || '',
            journal: url?.[4] || '',
            authors: Array.isArray(url?.[5]) ? url[5].join(', ') : (url?.[5] || ''),
            evidence: Array.isArray(evidence) ? evidence : [],
        };
        try {
            const next = await toggleBookmark(entry, { sourceHid });
            setIsBookmarked(next.some((item) => item.id === pubmedId || item.pmid === pubmedId));
        } catch (error) {
            setIsBookmarked(getBookmarks().some((item) => item.id === pubmedId || item.pmid === pubmedId));
        }
    };

    useEffect(() => {
        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getBookmarks();
            if (!isMounted) return;
            setIsBookmarked(next.some((item) => item.id === pubmedId || item.pmid === pubmedId));
        };
        update();
        if (isAuthenticated) {
            fetchBookmarks().then(update).catch(() => update());
        }
        window.addEventListener('glkb-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-bookmarks-updated', update);
        };
    }, [isAuthenticated, pubmedId]);

    const authors = Array.isArray(url?.[5]) ? url[5].join(', ') : (url?.[5] || '');
    const evidenceItems = useMemo(
        () => (Array.isArray(evidence) ? evidence.filter((item) => item?.quote) : []),
        [evidence]
    );
    const hasEvidence = evidenceItems.length > 0;

    // The meta line has to stay on a single row, so anything past the first
    // author collapses into "et al." rather than listing names.
    const renderAuthors = () => {
        const authorsList = authors.split(', ').filter(name => name.trim().length > 0);
        if (authorsList.length === 0) return null;
        if (authorsList.length === 1) return authorsList[0];
        return `${authorsList[0]} et al.`;
    };

    const citationCount = Number(url?.[2]);
    const hasCitationCount = showCitations && Number.isFinite(citationCount);
    const metaParts = [renderAuthors(), url?.[3]].filter(Boolean);

    // Only offer the expand affordance when the excerpt is actually clipped —
    // a quote that already fits should not show a chevron.
    const firstQuote = hasEvidence ? evidenceItems[0].quote : '';
    useEffect(() => {
        const node = quoteTextRef.current;
        if (!node) {
            setIsQuoteTruncated(false);
            return undefined;
        }
        const measure = () => {
            // scrollHeight exceeds clientHeight only while the line clamp is active.
            setIsQuoteTruncated(node.scrollHeight - node.clientHeight > 1);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [firstQuote, isEvidenceOpen]);

    const hasExtraExcerpts = evidenceItems.length > 1;
    const showQuoteToggle = hasEvidence && (isQuoteTruncated || isEvidenceOpen || hasExtraExcerpts);

    return (
        <div
            className={`reference-card${showHighlight ? ' is-highlighted' : ''}`}
        >
            {index !== null && (
                <div className="reference-card-index">
                    <span className="reference-card-index-badge">{index}</span>
                </div>
            )}
            <div className="reference-card-body">
                <div className="reference-card-head">
                    <div className="reference-card-title">
                        {url[0]}
                    </div>
                    {(metaParts.length > 0 || url[4]) && (
                        <div className="reference-card-meta">
                            {metaParts.join(' · ')}
                            {metaParts.length > 0 && url[4] && ' · '}
                            {url[4] && <span className="reference-card-journal">{url[4]}</span>}
                        </div>
                    )}
                </div>

                {hasEvidence && (
                    <div className="reference-card-quote">
                        <span className="reference-card-quote-bar" />
                        <div className="reference-card-quote-content">
                            <p
                                ref={quoteTextRef}
                                className={`reference-card-quote-text${isEvidenceOpen ? ' reference-card-quote-text--clamped-off' : ''}${showQuoteToggle ? '' : ' reference-card-quote-text--no-toggle'}`}
                            >
                                “{evidenceItems[0].quote}”
                            </p>
                            {showQuoteToggle && (
                                <Tooltip title={isEvidenceOpen ? 'Collapse excerpts' : 'Expand excerpts'} arrow>
                                    <IconButton
                                        size="small"
                                        className="reference-card-evidence-toggle"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setIsEvidenceOpen((previous) => !previous);
                                        }}
                                        aria-label={isEvidenceOpen ? 'Collapse excerpts' : 'Expand excerpts'}
                                        aria-expanded={isEvidenceOpen}
                                    >
                                        <ExpandMoreIcon
                                            sx={{
                                                fontSize: 14,
                                                transform: isEvidenceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                )}

                <div className="reference-card-footer">
                    <span className="reference-card-footer-meta">
                        PMID: {pubmedId}
                        {hasCitationCount && ` · ${citationCount} Citation${citationCount === 1 ? '' : 's'}`}
                    </span>
                    <div className="reference-card-actions" onClick={(event) => event.stopPropagation()}>
                        <Tooltip title={isBookmarked ? 'Remove bookmark' : 'Bookmark this reference'} arrow>
                            <IconButton
                                size="small"
                                onClick={handleBookmarkClick}
                                className="reference-card-icon-btn"
                            >
                                {isBookmarked ? (
                                    <BookmarkIcon sx={{ fontSize: 14, color: 'var(--color-brand-primary)' }} />
                                ) : (
                                    <BookmarkBorderIcon sx={{ fontSize: 14 }} />
                                )}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Cite paper" arrow>
                            <IconButton
                                size="small"
                                onClick={handleCiteClick}
                                className="reference-card-icon-btn"
                            >
                                <img
                                    src={formatQuoteIcon}
                                    alt="Quote"
                                    style={{ width: 13, height: 13, display: 'block' }}
                                />
                            </IconButton>
                        </Tooltip>
                        {/* url[6] is the PMC full text where the paper has one; url[1] is the
                            PubMed record, which is a fallback and not what this label promises. */}
                        <a
                            href={url[6] || url[1]}
                            className="reference-card-fulltext"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleClick(event, url[6] || url[1]);
                            }}
                        >
                            Full Text
                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                        </a>
                    </div>
                </div>

                {isEvidenceOpen && evidenceItems.slice(1).map((item, idx) => (
                    <div className="reference-card-quote" key={`${pubmedId}-evidence-${idx}`}>
                        <span className="reference-card-quote-bar" />
                        <p className="reference-card-quote-text reference-card-quote-text--clamped-off">“{item.quote}”</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReferenceCard;
