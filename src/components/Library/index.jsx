import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  useNavigate,
} from 'react-router-dom';

import { Bookmark as BookmarkIcon } from '@mui/icons-material';
import {
  Box,
  IconButton,
  Typography,
} from '@mui/material';

import { ReactComponent as BookIcon } from '../../img/navbar/book_4.svg';
import {
  fetchBookmarks,
  getBookmarks,
} from '../../utils/bookmarks';
import { setActiveConversationId } from '../../utils/chatHistory';
import {
  fetchConversationBookmarks,
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../utils/conversationBookmarks';
import { useAuth } from '../Auth/AuthContext';
import CiteDialog from '../Units/CiteDialog';
import ReferenceCard from '../Units/ReferenceCard/ReferenceCard';

const Library = () => {
    const navigate = useNavigate();
    const [bookmarks, setBookmarks] = useState([]);
    const [conversationBookmarks, setConversationBookmarks] = useState([]);
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        fetchBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setBookmarks(list);
            })
            .catch(() => {
                if (!isMounted) return;
                setBookmarks(getBookmarks());
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

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
    };

    const handleCiteClick = (citation) => {
        setSelectedCitation(citation);
        setCiteDialogOpen(true);
    };

    const handleCloseCiteDialog = () => {
        setCiteDialogOpen(false);
        setSelectedCitation(null);
    };

    const handleOpenConversation = (conversationId) => {
        if (!conversationId) return;
        setActiveConversationId(String(conversationId));
        navigate('/chat', { state: { conversationId: String(conversationId) } });
    };

    const handleToggleConversationBookmark = async (conversation) => {
        if (!conversation) return;
        const entry = {
            id: String(conversation.id),
            title: conversation.title || 'New Chat',
            updatedAt: conversation.updatedAt || new Date().toISOString(),
            messageCount: conversation.messageCount ?? 0,
        };
        try {
            const next = await toggleConversationBookmark(entry);
            setConversationBookmarks(next);
        } catch (error) {
            setConversationBookmarks(getConversationBookmarks());
        }
    };

    if (loading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="library-page">
            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />
            <Box className="library-body">
                <Box className="library-content">
                    <Box className="library-header">
                        <Box className="library-title-row">
                            <BookIcon className="library-book-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontWeight: 600,
                                fontSize: '32px',
                                color: '#164563',
                            }}>
                                Library
                            </Typography>
                        </Box>
                        <Typography sx={{
                            marginTop: '8px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            fontSize: '14px',
                            color: '#646464',
                            textAlign: 'left',
                            width: '100%',
                        }}>
                            Collect papers, explore connections, and organize your research journey.
                        </Typography>
                    </Box>
                    <Box className="library-scroll">
                        <Box className="library-section">
                            <Typography className="library-section-title">
                                Saved Chats
                            </Typography>
                            {conversationBookmarks.length > 0 ? (
                                <Box className="library-chat-list">
                                    {conversationBookmarks.map((conversation) => (
                                        <button
                                            key={conversation.id}
                                            type="button"
                                            className="library-chat-item"
                                            onClick={() => handleOpenConversation(conversation.id)}
                                        >
                                            <div className="library-chat-text">
                                                <Typography className="library-chat-title">
                                                    {conversation.title || 'New Chat'}
                                                </Typography>
                                                <Typography className="library-chat-subtitle">
                                                    {typeof conversation.messageCount === 'number'
                                                        ? `${conversation.messageCount} ${conversation.messageCount === 1 ? 'message' : 'messages'}`
                                                        : '0 messages'}
                                                </Typography>
                                            </div>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleToggleConversationBookmark(conversation);
                                                }}
                                                sx={{
                                                    padding: '4px',
                                                    color: '#2c5cf3',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                    },
                                                }}
                                                title="Remove bookmark"
                                            >
                                                <BookmarkIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </button>
                                    ))}
                                </Box>
                            ) : (
                                <Typography className="library-empty-text">
                                    No saved chats yet. Bookmark a chat to see it here.
                                </Typography>
                            )}
                        </Box>
                        <Box className="library-section">
                            <Typography className="library-section-title">
                                Saved References
                            </Typography>
                            <Box className="library-list">
                                {bookmarks.length > 0 ? (
                                    bookmarks.map((entry) => (
                                        <div key={entry.id}>
                                            <ReferenceCard
                                                url={[
                                                    entry.title,
                                                    entry.url,
                                                    entry.citation_count,
                                                    entry.year,
                                                    entry.journal,
                                                    entry.authors,
                                                ]}
                                                handleClick={handleClick}
                                                onCiteClick={handleCiteClick}
                                                transparentBackground
                                                showCitations={false}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <Typography className="library-empty-text">
                                        No bookmarks yet. Save references to see them here.
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default Library;
