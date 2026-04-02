import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Navigate,
  useNavigate,
} from 'react-router-dom';

import { DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  Tooltip,
  Typography,
} from '@mui/material';

import { ReactComponent as MetaIcon } from '../../img/library/Icon.svg';
import { ReactComponent as HistoryIcon } from '../../img/navbar/history.svg';
import {
  fetchConversations,
  getConversations,
  removeConversation,
  setActiveConversationId,
  updateConversationTitle,
} from '../../utils/chatHistory';
import {
  fetchConversationBookmarks,
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../utils/conversationBookmarks';
import {
  fetchGraphBookmarks,
  getGraphBookmarks,
  toggleGraphBookmark,
} from '../../utils/graphBookmarks';
import {
  fetchGraphHistories,
  getGraphHistories,
  removeGraphHistory,
} from '../../utils/graphHistory';
import { useAuth } from '../Auth/AuthContext';
import nodeStyleColors from '../Graph/nodeStyleColors.json';
import ConversationCard from '../Units/ConversationCard';

const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const parseTimestamp = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
        return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
            const numeric = Number(trimmed);
            return numeric < 1e12 ? numeric * 1000 : numeric;
        }
    }
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isNaN(time) ? null : time;
};

const formatRelativeTime = (value) => {
    const timestamp = parseTimestamp(value);
    if (!timestamp) return 'just now';
    const diffMs = Date.now() - timestamp;
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

const getConversationTitle = (conversation) => (
    conversation.leadingTitle || 'Untitled conversation'
);

const getConversationSubtitle = (conversation) => {
    const count = typeof conversation.messageCount === 'number'
        ? conversation.messageCount
        : 0;
    return `${count} ${count === 1 ? 'message' : 'messages'}`;
};

const hexToRgb = (hex) => {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const cleaned = hex.replace('#', '');
    const normalized = cleaned.length === 3
        ? cleaned.split('').map((char) => `${char}${char}`).join('')
        : cleaned;
    const value = parseInt(normalized, 16);
    if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

const rgbToHex = (r, g, b) => {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (baseHex, mixHexValue, amount) => {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHexValue);
    const ratio = Math.min(Math.max(amount, 0), 1);
    const r = Math.round(base.r * (1 - ratio) + mix.r * ratio);
    const g = Math.round(base.g * (1 - ratio) + mix.g * ratio);
    const b = Math.round(base.b * (1 - ratio) + mix.b * ratio);
    return rgbToHex(r, g, b);
};

const toRgba = (hex, alpha) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getPillColors = (label) => {
    const base = nodeStyleColors[label] || nodeStyleColors.default || '#E5E5E5';
    return {
        base,
        background: mixHex(base, '#ffffff', 0.75),
        text: mixHex(base, '#000000', 0.35),
        shadow: toRgba(base, 0.3),
    };
};

const normalizeGraphTermEntry = (term) => {
    if (!term) return null;
    if (typeof term === 'string') {
        const label = term.trim();
        if (!label) return null;
        return {
            id: 0,
            label,
            type: 'default',
        };
    }

    const label = (term?.name || term?.label || term?.term || '').trim();
    if (!label) return null;
    const rawId = term?.id ?? term?.database_id ?? term?.databaseId ?? 0;
    const parsedId = Number(rawId);

    return {
        id: Number.isFinite(parsedId) ? parsedId : 0,
        label,
        type: term?.type || term?.label_type || 'default',
    };
};

const buildGraphSearchPayload = (history) => {
    const normalizedTerms = (Array.isArray(history?.terms) ? history.terms : [])
        .map(normalizeGraphTermEntry)
        .filter(Boolean);

    if (!normalizedTerms.length) return null;

    return {
        triplets: normalizedTerms.map((term) => ({
            source: [term.id, term.label],
            rel: 'any relationships',
            target: [0, ''],
        })),
        params: {
            max_articles: 5,
            max_terms: 30,
            max_rels: 30,
            more_terms: 'False',
            more_rels: 'False',
            merge: 'True',
        },
        sources: normalizedTerms.map((term) => [
            term.id,
            term.label,
            term.type,
        ]),
    };
};

const History = () => {
    const navigate = useNavigate();
    const { isAuthenticated, loading } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [graphHistories, setGraphHistories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedGraphIds, setSelectedGraphIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [conversationBookmarks, setConversationBookmarks] = useState([]);
    const [graphBookmarks, setGraphBookmarks] = useState([]);

    const normalizedChatItems = useMemo(() => (
        conversations.map((conversation) => ({
            type: 'chat',
            id: String(conversation.id),
            conversation,
            title: getConversationTitle(conversation),
            subtitle: getConversationSubtitle(conversation),
            timestamp: formatTimestamp(conversation.updatedAt || conversation.createdAt),
            sortTime: conversation.updatedAt || conversation.createdAt || 0,
        }))
    ), [conversations]);

    const normalizedGraphItems = useMemo(() => (
        graphHistories.map((history) => ({
            type: 'graph',
            id: String(history.ghid ?? history.id),
            graphHistory: history,
            title: history.title || '',
            subtitle: '',
            timestamp: formatTimestamp(history.updatedAt || history.createdAt),
            sortTime: history.updatedAt || history.createdAt || 0,
            terms: Array.isArray(history.terms) ? history.terms : [],
        }))
    ), [graphHistories]);

    const mergedHistoryItems = useMemo(() => (
        [...normalizedChatItems, ...normalizedGraphItems]
            .sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime))
    ), [normalizedChatItems, normalizedGraphItems]);

    const filteredHistoryItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return mergedHistoryItems;
        return mergedHistoryItems.filter((item) => {
            if (item.type !== 'chat') return false;
            const title = item.title.toLowerCase();
            const subtitle = item.subtitle.toLowerCase();
            return title.includes(query) || subtitle.includes(query);
        });
    }, [mergedHistoryItems, searchQuery]);

    const filteredChatItems = useMemo(
        () => filteredHistoryItems.filter((item) => item.type === 'chat'),
        [filteredHistoryItems]
    );

    const filteredIds = filteredChatItems.map((item) => item.id);
    const selectedIdSet = new Set(selectedIds);
    const selectedFilteredCount = filteredIds.filter((id) => selectedIdSet.has(id)).length;
    const selectedCount = selectedIds.length;
    const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
    const isPartiallySelected = selectedFilteredCount > 0 && !allFilteredSelected;
    const bookmarkedConversationIds = useMemo(
        () => new Set(conversationBookmarks.map((item) => String(item?.id ?? item?.hid ?? ''))),
        [conversationBookmarks]
    );
    const bookmarkedGraphIds = useMemo(
        () => new Set(graphBookmarks.map((item) => String(item?.id ?? item?.ghid ?? ''))),
        [graphBookmarks]
    );
    const filteredTotalCount = filteredHistoryItems.length;

    useEffect(() => {
        if (loading || !isAuthenticated) {
            return undefined;
        }

        let isMounted = true;
        const cached = getConversations();
        if (cached.length > 0) {
            setConversations(cached);
        }

        fetchConversations()
            .then((list) => {
                if (!isMounted) return;
                setConversations(list);
            })
            .catch(() => {
                if (!isMounted) return;
                setConversations(getConversations());
            });

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setGraphHistories([]);
            return undefined;
        }

        let isMounted = true;
        const cached = getGraphHistories();
        if (cached.length > 0) {
            setGraphHistories(cached);
        }

        const handleUpdate = (event) => {
            const next = event?.detail || getGraphHistories();
            if (!isMounted) return;
            setGraphHistories(next);
        };

        fetchGraphHistories()
            .then((list) => {
                if (!isMounted) return;
                setGraphHistories(list);
            })
            .catch(() => handleUpdate());

        window.addEventListener('glkb-graph-histories-updated', handleUpdate);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-graph-histories-updated', handleUpdate);
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setConversationBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getConversationBookmarks();
            if (!isMounted) return;
            setConversationBookmarks(next);
        };

        fetchConversationBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setConversationBookmarks(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-conversation-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-conversation-bookmarks-updated', update);
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setGraphBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getGraphBookmarks();
            if (!isMounted) return;
            setGraphBookmarks(next);
        };

        fetchGraphBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setGraphBookmarks(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-graph-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-graph-bookmarks-updated', update);
        };
    }, [isAuthenticated, loading]);

    const handleOpenConversation = (conversationId) => {
        if (selectMode) return;
        setActiveConversationId(conversationId);
        navigate('/chat', { state: { conversationId } });
    };

    const handleOpenGraph = (history) => {
        const searchData = buildGraphSearchPayload(history);
        if (!searchData) return;
        navigate('/search', { state: { search_data: searchData } });
    };

    const handleToggleSelectMode = () => {
        setSelectMode((prev) => {
            if (prev) {
                setSelectedIds([]);
            }
            return !prev;
        });
    };

    const handleToggleConversationSelection = (conversationId, forceSelectMode = false) => {
        if (!selectMode) {
            if (!forceSelectMode) return;
            setSelectMode(true);
            setSelectedIds([conversationId]);
            return;
        }
        setSelectedIds((prev) => (
            prev.includes(conversationId)
                ? prev.filter((id) => id !== conversationId)
                : [...prev, conversationId]
        ));
    };

    const handleToggleGraphSelection = (graphId) => {
        if (!graphId) return;
        setSelectedGraphIds((prev) => (
            prev.includes(graphId)
                ? prev.filter((id) => id !== graphId)
                : [...prev, graphId]
        ));
    };

    const handleToggleSelectAllFiltered = () => {
        setSelectedIds((prev) => {
            const prevSet = new Set(prev);
            if (allFilteredSelected) {
                return prev.filter((id) => !filteredIds.includes(id));
            }
            filteredIds.forEach((id) => prevSet.add(id));
            return Array.from(prevSet);
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedCount === 0 || isDeleting) return;
        setIsDeleting(true);
        const idsToDelete = [...selectedIds];
        await Promise.allSettled(idsToDelete.map((id) => removeConversation(id)));
        setConversations((prev) => prev.filter((conversation) => !idsToDelete.includes(conversation.id)));
        setSelectedIds([]);
        setSelectMode(false);
        setIsDeleting(false);
    };

    const handleRenameConversation = async (conversation, nextTitle) => {
        if (!conversation?.id) return;
        try {
            await updateConversationTitle(String(conversation.id), nextTitle);
            setConversations(getConversations());
        } catch (error) {
            // Ignore rename failures.
        }
    };

    const handleBookmarkConversation = async (conversation) => {
        if (!conversation) return;
        const entry = {
            id: String(conversation.id),
            title: getConversationTitle(conversation),
            updatedAt: conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
            messageCount: conversation.messageCount ?? 0,
        };
        try {
            const next = await toggleConversationBookmark(entry);
            setConversationBookmarks(next);
        } catch (error) {
            // Ignore bookmark failures.
            setConversationBookmarks(getConversationBookmarks());
        }
    };

    const handleBookmarkGraph = async (history) => {
        if (!history) return;
        const entry = {
            id: String(history.ghid ?? history.id),
            ghid: history.ghid ?? history.id,
            title: history.title || '',
            endpointType: history.endpointType || history.endpoint_type || '',
            updatedAt: history.updatedAt || history.createdAt || new Date().toISOString(),
        };
        try {
            const next = await toggleGraphBookmark(entry, history.terms || []);
            setGraphBookmarks(next);
        } catch (error) {
            setGraphBookmarks(getGraphBookmarks());
        }
    };

    const handleDeleteConversation = async (conversation) => {
        if (!conversation?.id) return;
        const idToDelete = String(conversation.id);
        try {
            await removeConversation(idToDelete);
        } catch (error) {
            // Ignore delete failures.
        }
        setConversations((prev) => prev.filter((item) => String(item.id) !== idToDelete));
        setSelectedIds((prev) => prev.filter((id) => String(id) !== idToDelete));
    };

    const handleDeleteGraphHistory = async (history) => {
        const idToDelete = String(history?.ghid ?? history?.id ?? '');
        if (!idToDelete) return;
        try {
            await removeGraphHistory(idToDelete);
        } catch (error) {
            // Ignore delete failures.
        }
        setGraphHistories((prev) => prev.filter((item) => String(item.id) !== idToDelete));
        setSelectedGraphIds((prev) => prev.filter((id) => String(id) !== idToDelete));
    };

    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => conversations.some((conversation) => conversation.id === id)));
    }, [conversations]);

    useEffect(() => {
        setSelectedGraphIds((prev) => prev.filter((id) => graphHistories.some((history) => String(history.id) === String(id))));
    }, [graphHistories]);

    if (loading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="history-page">
            <Box className="history-body">
                <Box className="history-content">
                    <Box className="history-top">
                        <Box className="history-header">
                            <Box className="history-title-row">
                                <HistoryIcon className="history-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                                <Typography sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '32px',
                                    color: '#164563',
                                }}>
                                    History
                                </Typography>
                            </Box>
                            <Typography sx={{
                                marginTop: '8.5px',
                                fontFamily: 'DM Sans, sans-serif',
                                fontWeight: 500,
                                fontSize: '14px',
                                color: '#646464',
                                textAlign: 'left',
                            }}>
                                Search your past activity.
                            </Typography>
                            <div className="history-search">
                                <input
                                    className="history-search-input"
                                    type="text"
                                    id="history-search"
                                    name="historySearch"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search conversations"
                                    aria-label="Search conversations"
                                />
                                {searchQuery.trim() && (
                                    <button
                                        type="button"
                                        className="history-search-clear"
                                        onClick={() => setSearchQuery('')}
                                        aria-label="Clear search"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </Box>
                        <Box className="history-meta-row">
                            {selectMode ? (
                                <>
                                    <Box className="history-select-toolbar">
                                        <Tooltip
                                            title={allFilteredSelected ? 'Deselect All' : 'Select All'}
                                            placement="bottom"
                                            PopperProps={{
                                                modifiers: [
                                                    {
                                                        name: 'offset',
                                                        options: {
                                                            offset: [0, -4],
                                                        },
                                                    },
                                                ],
                                            }}
                                            componentsProps={{
                                                tooltip: {
                                                    sx: {
                                                        backgroundColor: '#E7F1FF',
                                                        color: '#164563',
                                                        fontFamily: 'DM Sans, sans-serif',
                                                        fontSize: '14px',
                                                        fontWeight: 500,
                                                        padding: '4px 12px',
                                                        borderRadius: '8px',
                                                        boxShadow: 'none',
                                                    },
                                                },
                                            }}
                                        >
                                            <span>
                                                <Checkbox
                                                    className="history-select-all-checkbox"
                                                    checked={allFilteredSelected}
                                                    indeterminate={isPartiallySelected}
                                                    onChange={handleToggleSelectAllFiltered}
                                                    inputProps={{ 'aria-label': 'Select all conversations' }}
                                                    sx={{
                                                        color: '#D9D9D9',
                                                        padding: '4px',
                                                        '&.Mui-checked': { color: '#155DFC' },
                                                        '&.MuiCheckbox-indeterminate': { color: '#155DFC' },
                                                    }}
                                                />
                                            </span>
                                        </Tooltip>
                                        <Box className="history-select-toolbar-content">
                                            <Typography className="history-meta-text">
                                                {selectedCount} selected
                                            </Typography>
                                            <button
                                                type="button"
                                                className="history-delete-action"
                                                onClick={handleDeleteSelected}
                                                disabled={selectedCount === 0 || isDeleting}
                                            >
                                                Delete
                                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                            </button>
                                        </Box>
                                    </Box>
                                    <button
                                        type="button"
                                        className="history-select-toggle"
                                        onClick={handleToggleSelectMode}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Box className="history-select-toolbar history-select-toolbar-empty">
                                        <Box className="history-select-toolbar-content">
                                            <Typography className="history-meta-text">
                                                {filteredTotalCount} search history records with GLKB
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <button
                                        type="button"
                                        className="history-select-toggle"
                                        onClick={handleToggleSelectMode}
                                    >
                                        Select
                                    </button>
                                </>
                            )}
                        </Box>
                    </Box>
                    <Box className="history-list">
                        {filteredHistoryItems.length > 0 ? (
                            filteredHistoryItems.map((item) => (
                                item.type === 'chat' ? (
                                    <ConversationCard
                                        key={`chat-${item.id}`}
                                        conversation={item.conversation}
                                        title={item.title}
                                        subtitle={item.subtitle}
                                        footerContent={(
                                            <div className="history-card-meta">
                                                <MetaIcon className="history-card-meta-icon" />
                                                <span>{formatRelativeTime(item.conversation?.updatedAt || item.conversation?.createdAt)}</span>
                                                <span className="history-card-meta-sep">|</span>
                                                <span>Chat</span>
                                            </div>
                                        )}
                                        timestamp={item.timestamp}
                                        selectMode={selectMode}
                                        isSelected={selectedIdSet.has(item.id)}
                                        showCheckboxOnHover
                                        isBookmarked={bookmarkedConversationIds.has(item.id)}
                                        onToggleSelect={handleToggleConversationSelection}
                                        onOpen={(opened) => handleOpenConversation(opened.id)}
                                        onRename={handleRenameConversation}
                                        onBookmark={handleBookmarkConversation}
                                        onDelete={handleDeleteConversation}
                                    />
                                ) : (
                                    <ConversationCard
                                        key={`graph-${item.id}`}
                                        conversation={item.graphHistory}
                                        titleContent={item.terms.length > 0 ? (
                                            <Box className="history-graph-pill-row">
                                                {item.terms.map((term, index) => {
                                                    const label = term?.name || term?.label || '';
                                                    if (!label) return null;
                                                    const colors = getPillColors(term?.type || 'default');
                                                    return (
                                                        <Box
                                                            key={`${item.id}-term-${index}`}
                                                            className="history-graph-pill"
                                                            sx={{
                                                                borderColor: colors.base,
                                                                backgroundColor: colors.background,
                                                                color: colors.text,
                                                                boxShadow: `0px 4px 6px ${colors.shadow}`,
                                                            }}
                                                        >
                                                            <span className="history-graph-pill-label">{label}</span>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        ) : null}
                                        title=""
                                        subtitle={item.subtitle}
                                        footerContent={(
                                            <div className="history-card-meta">
                                                <MetaIcon className="history-card-meta-icon" />
                                                <span>{formatRelativeTime(item.graphHistory?.createdAt || item.graphHistory?.updatedAt)}</span>
                                                <span className="history-card-meta-sep">|</span>
                                                <span>Map</span>
                                            </div>
                                        )}
                                        timestamp={item.timestamp}
                                        selectMode={false}
                                        isSelected={selectedGraphIds.includes(item.id)}
                                        showCheckboxOnHover
                                        onToggleSelect={handleToggleGraphSelection}
                                        onOpen={handleOpenGraph}
                                        isBookmarked={bookmarkedGraphIds.has(item.id)}
                                        onBookmark={handleBookmarkGraph}
                                        onDelete={handleDeleteGraphHistory}
                                    />
                                )
                            ))
                        ) : (
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '14px',
                                color: '#646464',
                            }}>
                                {searchQuery.trim() ? 'No matches found.' : 'No history yet.'}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default History;
