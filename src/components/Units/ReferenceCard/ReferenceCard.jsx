import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { IconButton } from '@mui/material';

import formatQuoteIcon from '../../../img/llm/format_quote.svg';
import {
  fetchBookmarks,
  getBookmarks,
  toggleBookmark,
} from '../../../utils/bookmarks';
import { useAuth } from '../../Auth/AuthContext';

const ReferenceCard = ({
    url,
    evidence = [],
    sourceHid = null,
    handleClick,
    onCiteClick,
    isHighlighted = false,
    transparentBackground = false,
    showCitations = true,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
    const { isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();
    const showHighlight = isHighlighted || isHovered;

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
            navigate('/login');
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

    const getLastName = (fullName) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    };


    const renderAuthors = () => {
        const authorsList = authors.split(', ').filter(name => name.trim().length > 0);
        if (authorsList.length === 0) return null;
        if (authorsList.length === 1) {
            return renderAuthorBubbles([authorsList[0]]);
        }
        if (authorsList.length === 2) {
            return renderAuthorBubbles(authorsList);
        }
        return renderAuthorBubbles([
            authorsList[0],
            '...',
            authorsList[authorsList.length - 1]
        ]);
    };
    const renderAuthorBubbles = (list) => (
        list.map((author, idx) => (
            <span
                key={idx}
            >
                {author}{idx < list.length - 1 ? ',' : ''}
            </span>
        ))
    );
    return (
        <div
            onClick={(event) => handleClick(event, url[1])}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                cursor: 'pointer',
                marginBottom: '2px',
                borderRadius: showHighlight ? '12px' : '10px',
                backgroundColor: showHighlight ? '#E7F1FF' : (transparentBackground ? 'transparent' : '#fff'),
                width: '100%',
                transition: 'background-color 0.2s ease, border-radius 0.2s ease',
                padding: '0px',
                fontFamily: 'DM Sans, sans-serif',
            }}
            className="custom-div-url"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ color: '#808080', fontSize: '14px', fontWeight: 400 }}>
                    PubMed ID: {pubmedId}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconButton
                        size="small"
                        onClick={handleCiteClick}
                        sx={{
                            padding: '4px',
                            color: '#323232',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            },
                        }}
                        title="Cite this reference"
                    >
                        <img
                            src={formatQuoteIcon}
                            alt="Quote"
                            style={{ width: '18px', height: '18px', display: 'block' }}
                        />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={handleBookmarkClick}
                        sx={{
                            padding: '4px',
                            color: isBookmarked ? '#2c5cf3' : '#323232',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            },
                        }}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark this reference'}
                    >
                        {isBookmarked ? (
                            <BookmarkIcon sx={{ fontSize: 18 }} />
                        ) : (
                            <BookmarkBorderIcon sx={{ fontSize: 18 }} />
                        )}
                    </IconButton>
                </div>
            </div>

            <a
                href={url[1]}
                onClick={(event) => {
                    event.stopPropagation();
                    handleClick(event, url[1]);
                }}
                style={{
                    color: '#323232',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '16px',
                    display: 'block',
                    marginBottom: '6px',
                    wordBreak: 'break-word',
                }}
            >
                {url[0]}
            </a>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '6px',
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: '#808080',
                    flex: 1,
                }}>
                    {renderAuthors()}
                </div>
                {showCitations && !hasEvidence && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#323232',
                        lineHeight: '16px',
                        flexShrink: 0,
                    }}>
                        <span>Citations: {url[2]}</span>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: '12px',
            }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#323232',
                    wordBreak: 'break-word',
                    flex: 1,
                }} title="Journal">
                    {url[4]}
                </div>
                {!hasEvidence && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#323232',
                        lineHeight: '16px',
                        flexShrink: 0,
                    }}>
                        <span>{url[3]}</span>
                    </div>
                )}
                {showCitations && hasEvidence && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#323232',
                        lineHeight: '16px',
                        flexShrink: 0,
                    }}>
                        <span>Citations: {url[2]}</span>
                    </div>
                )}
            </div>
            {hasEvidence && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '4px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '20px',
                    }}>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsEvidenceOpen((prev) => !prev);
                            }}
                            style={{
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#2c5cf3',
                                cursor: 'pointer',
                            }}
                            aria-expanded={isEvidenceOpen}
                        >
                            Original sentences
                            <ExpandMoreIcon
                                sx={{
                                    fontSize: 16,
                                    color: '#2c5cf3',
                                    transform: isEvidenceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                }}
                            />
                        </button>
                    </div>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#323232',
                        lineHeight: 1.4,
                        flexShrink: 0,
                    }}>
                        <span>{url[3]}</span>
                    </div>
                </div>
            )}
            {hasEvidence && isEvidenceOpen && (
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '13px',
                    fontWeight: 400,
                    color: '#646464',
                }}>
                    {evidenceItems.map((item, idx) => (
                        <div key={`${pubmedId}-evidence-${idx}`} style={{ lineHeight: 1.5 }}>
                            “{item.quote}”
                        </div>
                    ))}
                </div>
            )}
        </div>


    );
};

export default ReferenceCard;
