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
import { useAuth } from '../Auth/AuthContext';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [conversationBookmarks, setConversationBookmarks] = useState([]);
    const [referenceBookmarks, setReferenceBookmarks] = useState([]);
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);

    const filteredConversations = conversations.filter((conversation) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const title = getConversationTitle(conversation).toLowerCase();
        const subtitle = getConversationSubtitle(conversation).toLowerCase();
        return title.includes(query) || subtitle.includes(query);
    });

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

    const filteredIds = filteredConversations.map((conversation) => conversation.id);
    const selectedIdSet = new Set(selectedIds);
    const selectedFilteredCount = filteredIds.filter((id) => selectedIdSet.has(id)).length;
    const selectedCount = selectedIds.length;
    const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
    const isPartiallySelected = selectedFilteredCount > 0 && !allFilteredSelected;
    const bookmarkedConversationIds = useMemo(
        () => new Set(conversationBookmarks.map((item) => String(item?.id ?? item?.hid ?? ''))),
        [conversationBookmarks]
    );
    const filteredTotalCount = filteredConversations.length + (selectMode ? 0 : filteredReferences.length);

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

    const handleToggleConversationSelection = (conversationId) => {
        setSelectedIds((prev) => (
            prev.includes(conversationId)
                ? prev.filter((id) => id !== conversationId)
                : [...prev, conversationId]
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
                                marginTop: '8px',
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
                                                        color: '#155DFC',
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
                        {filteredConversations.length > 0 ? (
                            filteredConversations.map((conversation) => (
                                <ConversationCard
                                    key={conversation.id}
                                    conversation={conversation}
                                    title={getConversationTitle(conversation)}
                                    subtitle={getConversationSubtitle(conversation)}
                                    timestamp={formatTimestamp(conversation.updatedAt || conversation.createdAt)}
                                    selectMode={selectMode}
                                    isSelected={selectedIdSet.has(conversation.id)}
                                    isBookmarked={bookmarkedConversationIds.has(String(conversation.id))}
                                    onToggleSelect={handleToggleConversationSelection}
                                    onOpen={(item) => handleOpenConversation(item.id)}
                                    onRename={handleRenameConversation}
                                    onBookmark={handleBookmarkConversation}
                                    onDelete={handleDeleteConversation}
                                />
                            ))
                        ) : (
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '14px',
                                color: '#646464',
                            }}>
                                {searchQuery.trim() ? 'No matches found.' : 'No conversations yet.'}
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
