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
  Typography,
} from '@mui/material';

import { ReactComponent as HistoryIcon } from '../../img/navbar/history.svg';
import {
  fetchConversations,
  getConversations,
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

    const filteredConversations = conversations.filter((conversation) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const title = getConversationTitle(conversation).toLowerCase();
        const subtitle = getConversationSubtitle(conversation).toLowerCase();
        return title.includes(query) || subtitle.includes(query);
    });

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
        setActiveConversationId(conversationId);
        navigate('/chat', { state: { conversationId } });
    };

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
                        <Typography sx={{
                            marginTop: '8px',
                            fontFamily: 'DM Sans',
                            fontWeight: 500,
                            fontSize: '13px',
                            color: '#808080',
                        }}>
                            {filteredConversations.length} search history records with GLKB
                        </Typography>
                    </Box>
                    <Box className="history-list">
                        {filteredConversations.length > 0 ? (
                            filteredConversations.map((conversation) => (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    className="history-item"
                                    onClick={() => handleOpenConversation(conversation.id)}
                                >
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
                                </button>
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
