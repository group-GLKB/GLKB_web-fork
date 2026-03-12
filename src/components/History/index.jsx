import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Box,
  Typography,
} from '@mui/material';

import { ReactComponent as HistoryIcon } from '../../img/navbar/history.svg';
import {
  getConversations,
  migrateLegacyChatHistory,
  setActiveConversationId,
} from '../../utils/chatHistory';
import NavBarWhite from '../Units/NavBarWhite';

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

const getConversationTitle = (conversation) => {
    const firstUser = conversation.messages?.find((msg) => msg.role === 'user');
    return firstUser?.content || 'Untitled conversation';
};

const getConversationSubtitle = (conversation) => {
    const firstAssistant = conversation.messages?.find((msg) => msg.role === 'assistant');
    return firstAssistant?.content || 'No response yet.';
};

const History = () => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);

    useEffect(() => {
        migrateLegacyChatHistory();
        setConversations(getConversations());
    }, []);

    const handleOpenConversation = (conversationId) => {
        setActiveConversationId(conversationId);
        navigate('/chat', { state: { conversationId } });
    };

    return (
        <div className="history-page">
            <NavBarWhite />
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
                    </Box>
                    <Box className="history-list">
                        {conversations.length > 0 ? (
                            conversations.map((conversation) => (
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
                                No conversations yet.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default History;
