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

import {
    Bookmark as BookmarkIcon,
    DeleteOutline as DeleteOutlineIcon,
    FormatQuoteOutlined as FormatQuoteOutlinedIcon,
    MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import {
    Box,
    Checkbox,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from '@mui/material';

import { ReactComponent as HistoryIcon } from '../../img/navbar/history.svg';
import {
    fetchBookmarks,
    getBookmarks,
    toggleBookmark,
} from '../../utils/bookmarks';
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
import CiteDialog from '../Units/CiteDialog';
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

const getConversationTitle = (conversation) => (
    conversation.leadingTitle || 'Untitled conversation'
);

const getConversationSubtitle = (conversation) => {
    const count = typeof conversation.messageCount === 'number'
        ? conversation.messageCount
        : 0;
    return `${count} ${count === 1 ? 'message' : 'messages'}`;
};

const buildReferenceCitation = (entry) => ([
    entry?.title || '',
    entry?.url || '',
    entry?.citation_count ?? 0,
    entry?.year ?? '',
    entry?.journal || '',
    entry?.authors || '',
]);

const getReferenceSubtitle = (entry) => {
    const journal = entry?.journal || '';
    const year = entry?.year || '';
    if (journal && year) return `${journal} - ${year}`;
    if (journal) return journal;
    if (year) return year;
    return entry?.authors || '';
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

const HistoryReferenceCard = ({ entry, onOpen, onRemoveBookmark, onCite }) => {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
    };

    const handleRemoveBookmark = () => {
        handleCloseMenu();
        if (onRemoveBookmark) {
            onRemoveBookmark(entry);
        }
    };

    const handleCite = () => {
        handleCloseMenu();
        if (onCite) {
            onCite(entry);
        }
    };

    return (
        <Box className="history-item-row">
            <div
                role="button"
                tabIndex={0}
                className="history-item"
                onClick={() => {
                    if (onOpen) {
                        onOpen(entry);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (onOpen) {
                            onOpen(entry);
                        }
                    }
                }}
            >
                <Box className="history-item-content">
                    <Box className="history-item-title-row">
                        <Typography className="history-title" sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 600,
                            fontSize: '16px',
                            color: '#164563',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {entry?.title || 'Untitled reference'}
                        </Typography>
                        <IconButton
                            size="small"
                            className="history-item-more"
                            onClick={handleOpenMenu}
                            aria-label="Open reference menu"
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '8px',
                                color: '#164563',
                            }}
                        >
                            <MoreHorizIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Box>
                    <Typography className="history-subtitle">
                        {getReferenceSubtitle(entry)}
                    </Typography>
                    {entry?.created_at && (
                        <Typography className="history-timestamp">
                            {formatTimestamp(entry.created_at)}
                        </Typography>
                    )}
                </Box>
            </div>
            <Menu
                anchorEl={menuAnchorEl}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{
                    sx: {
                        py: 0.5,
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 176,
                        borderRadius: 2,
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#164563',
                            py: 0.75,
                            px: 1.25,
                        },
                    },
                }}
            >
                <MenuItem onClick={handleRemoveBookmark}>
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <BookmarkIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Remove bookmark
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={handleCite}>
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <FormatQuoteOutlinedIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Cite
                    </ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
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
    const [referenceBookmarks, setReferenceBookmarks] = useState([]);
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);

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

    const filteredReferences = referenceBookmarks.filter((entry) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const haystack = [
            entry?.title,
            entry?.journal,
            entry?.authors,
            entry?.year,
            entry?.url,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(query);
    });

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
    const filteredTotalCount = filteredHistoryItems.length + (selectMode ? 0 : filteredReferences.length);

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

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setReferenceBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getBookmarks();
            if (!isMounted) return;
            setReferenceBookmarks(next);
        };

        fetchBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setReferenceBookmarks(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-bookmarks-updated', update);
        };
    }, [isAuthenticated, loading]);

    const handleOpenConversation = (conversationId) => {
        if (selectMode) return;
        setActiveConversationId(conversationId);
        navigate('/chat', { state: { conversationId } });
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

    const handleOpenReference = (entry) => {
        if (!entry?.url) return;
        window.open(entry.url, '_blank');
    };

    const handleRemoveReferenceBookmark = async (entry) => {
        if (!entry) return;
        try {
            const next = await toggleBookmark(entry, { sourceHid: entry.source_hid });
            setReferenceBookmarks(next);
        } catch (error) {
            setReferenceBookmarks(getBookmarks());
        }
    };

    const handleCiteReference = (entry) => {
        setSelectedCitation(buildReferenceCitation(entry));
        setCiteDialogOpen(true);
    };

    const handleCloseCiteDialog = () => {
        setCiteDialogOpen(false);
        setSelectedCitation(null);
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
            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />
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
                                Search for archived reference, chat, etc.
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
                                        timestamp={item.timestamp}
                                        selectMode={false}
                                        isSelected={selectedGraphIds.includes(item.id)}
                                        showCheckboxOnHover
                                        onToggleSelect={handleToggleGraphSelection}
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
                        {!selectMode && filteredReferences.length > 0 && (
                            <>
                                <Typography className="history-section-title">
                                    Saved References
                                </Typography>
                                {filteredReferences.map((entry) => (
                                    <HistoryReferenceCard
                                        key={entry.id}
                                        entry={entry}
                                        onOpen={handleOpenReference}
                                        onRemoveBookmark={handleRemoveReferenceBookmark}
                                        onCite={handleCiteReference}
                                    />
                                ))}
                            </>
                        )}
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default History;
