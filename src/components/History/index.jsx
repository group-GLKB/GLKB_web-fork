import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  useNavigate,
} from 'react-router-dom';

import {
  Box,
    Checkbox,
  Typography,
} from '@mui/material';
import { DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';

import { ReactComponent as HistoryIcon } from '../../img/navbar/history.svg';
import {
  fetchConversations,
  getConversations,
    removeConversation,
  setActiveConversationId,
} from '../../utils/chatHistory';
import { useAuth } from '../Auth/AuthContext';

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

const History = () => {
    const navigate = useNavigate();
    const { isAuthenticated, loading } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredConversations = conversations.filter((conversation) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const title = getConversationTitle(conversation).toLowerCase();
        const subtitle = getConversationSubtitle(conversation).toLowerCase();
        return title.includes(query) || subtitle.includes(query);
    });

    const filteredIds = filteredConversations.map((conversation) => conversation.id);
    const selectedIdSet = new Set(selectedIds);
    const selectedFilteredCount = filteredIds.filter((id) => selectedIdSet.has(id)).length;
    const selectedCount = selectedIds.length;
    const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
    const isPartiallySelected = selectedFilteredCount > 0 && !allFilteredSelected;

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
            <Box className="history-body">
                <Box className="history-content">
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
                        <Box className="history-meta-row">
                            {selectMode ? (
                                <>
                                    <Box className="history-select-toolbar">
                                        <Checkbox
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
                                    <Typography className="history-meta-text">
                                        {filteredConversations.length} search history records with GLKB
                                    </Typography>
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
                                <Box
                                    key={conversation.id}
                                    className={`history-item-row${selectMode ? ' history-item-row-select-mode' : ''}`}
                                >
                                    {selectMode && (
                                        <Checkbox
                                            className="history-row-checkbox"
                                            checked={selectedIdSet.has(conversation.id)}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                            }}
                                            onChange={() => handleToggleConversationSelection(conversation.id)}
                                            inputProps={{ 'aria-label': `Select ${getConversationTitle(conversation)}` }}
                                            sx={{
                                                color: '#155DFC',
                                                padding: '4px',
                                                '&.Mui-checked': { color: '#155DFC' },
                                            }}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        className="history-item"
                                        onClick={() => {
                                            if (selectMode) {
                                                handleToggleConversationSelection(conversation.id);
                                                return;
                                            }
                                            handleOpenConversation(conversation.id);
                                        }}
                                    >
                                        <Box className="history-item-content">
                                            <Typography sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 600,
                                                fontSize: '16px',
                                                color: '#164563',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {getConversationTitle(conversation)}
                                            </Typography>
                                            <Typography sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 400,
                                                fontSize: '14px',
                                                color: '#646464',
                                                overflow: 'hidden',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                            }}>
                                                {getConversationSubtitle(conversation)}
                                            </Typography>
                                            <Typography sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 500,
                                                fontSize: '12px',
                                                color: '#808080',
                                            }}>
                                                {formatTimestamp(conversation.updatedAt || conversation.createdAt)}
                                            </Typography>
                                        </Box>
                                    </button>
                                </Box>
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
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default History;
