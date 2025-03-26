import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import NavBarWhite from '../Units/NavBarWhite';
import { Spin, Button, message } from 'antd';
import { LLMAgentService } from '../../service/LLMAgent';
import { DeleteOutlined, FileTextOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, RedoOutlined } from '@ant-design/icons';
import './scoped.css';
import systemIcon from '../../img/Asset 1.png';
import ReactMarkdown from 'react-markdown';
import GLKBLogo from '../../img/glkb_dark.jpg';
import MessageList from './richtext';

import {
    Card,
    CardContent,
    Typography,
    Box,
    CircularProgress,
    IconButton,
    Stack,
    Container,
    Avatar,
    Icon,
    TextField
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilePresentIcon from '@mui/icons-material/FilePresent';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';

// import ShareIcon from "@mui/icons-material/Share";
// import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
// import BookmarkIcon from "@mui/icons-material/Bookmark";
// import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
// import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
// import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
// import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
// import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";


function LLMAgent() {
    const location = useLocation();
    const [userInput, setUserInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingSteps, setStreamingSteps] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editedMessageContent, setEditedMessageContent] = useState('');
    const messagesEndRef = useRef(null);

    // Create a single instance of LLMAgentService that persists across re-renders
    const llmService = React.useMemo(() => new LLMAgentService(), []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, streamingSteps]);

    useEffect(() => {
        if (location.state && location.state.initialQuery && chatHistory.length === 0) {
            const query = location.state.initialQuery;
            handleExampleClick(query);
        }
    }, [location.state]);

    const parseReferences = (refs) => {
        if (!refs || !Array.isArray(refs)) return [];

        return refs.map(ref => {
            const [title, pubmed_url, citation_count, year, journal, authors] = ref;
            return {
                title: title,
                url: pubmed_url,
                citation_count: citation_count,
                year: year,
                journal: journal,
                authors: Array.isArray(authors) ? authors.join(', ') : 'Authors not available'
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        // Create new user message
        const newMessage = {
            role: 'user',
            content: userInput,
            references: []
        };

        // Update chat history with user message
        setChatHistory(prev => [...prev, newMessage]);
        setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            // Convert chat history to format expected by backend
            const conversationHistory = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add current message to history
            conversationHistory.push({
                role: newMessage.role,
                content: newMessage.content
            });

            await llmService.chat(userInput, (update) => {
                switch (update.type) {
                    case 'step':
                        setStreamingSteps(prev => {
                            const newSteps = [...prev];
                            const cleanContent = update.content.replace(/\u001b\[\d+m/g, '').trim();
                            if (cleanContent) {
                                newSteps.push({
                                    step: update.step,
                                    content: cleanContent
                                });
                            }
                            return newSteps;
                        });
                        break;
                    case 'final':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                steps: streamingSteps
                            };
                            newHistory.push(assistantMessage);

                            // Update the LLMAgentService's internal message history
                            llmService.updateMessages(update.answer);

                            return newHistory;
                        });
                        setSelectedMessageIndex(chatHistory.length + 1);
                        break;
                    case 'error':
                        setIsProcessing(false);
                        setChatHistory(prev => [...prev, {
                            role: 'assistant',
                            content: `Error: ${update.error}`,
                            references: [],
                            steps: []
                        }]);
                        break;
                }
            }, conversationHistory); // Pass the conversation history to chat method
        } catch (error) {
            console.error('Error in chat:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                references: [],
                steps: []
            }]);
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const handleEditMessage = (index) => {
        if (chatHistory[index].role === 'user') {
            setEditingMessageIndex(index);
            setEditedMessageContent(chatHistory[index].content);
        }
    };

    const handleSaveEdit = async (index) => {
        if (editedMessageContent.trim() === '') return;

        const newChatHistory = [...chatHistory];
        newChatHistory[index] = {
            ...newChatHistory[index],
            content: editedMessageContent
        };

        const editedHistory = newChatHistory.slice(0, index + 1);
        setChatHistory(editedHistory);

        setEditingMessageIndex(null);
        setEditedMessageContent('');

        if (index < newChatHistory.length - 1) {
            setIsLoading(true);
            setIsProcessing(true);
            setStreamingSteps([]);

            try {
                const conversationHistory = editedHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                await llmService.chat(editedMessageContent, (update) => {

                    switch (update.type) {
                        case 'step':
                            setStreamingSteps(prev => {
                                const newSteps = [...prev];
                                const cleanContent = update.content.replace(/\u001b\[\d+m/g, '').trim();
                                if (cleanContent) {
                                    newSteps.push({
                                        step: update.step,
                                        content: cleanContent
                                    });
                                }
                                return newSteps;
                            });
                            break;
                        case 'final':
                            setIsProcessing(false);
                            setChatHistory(prev => {
                                const assistantMessage = {
                                    role: 'assistant',
                                    content: update.answer,
                                    references: parseReferences(update.references),
                                    steps: streamingSteps
                                };
                                return [...prev, assistantMessage];
                            });
                            break;
                        case 'error':
                            setIsProcessing(false);
                            setChatHistory(prev => [...prev, {
                                role: 'assistant',
                                content: `Error: ${update.error}`,
                                references: [],
                                steps: []
                            }]);
                            break;
                    }
                }, conversationHistory);
            } catch (error) {
                console.error('Error in chat after edit:', error);
                setChatHistory(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error while processing your edited request. Please try again.',
                    references: [],
                    steps: []
                }]);
            } finally {
                setIsLoading(false);
                setIsProcessing(false);
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingMessageIndex(null);
        setEditedMessageContent('');
    };

    const handleCopyMessage = (content) => {
        navigator.clipboard.writeText(content)
            .then(() => {
                message.success('Content copied to clipboard');
            })
            .catch(err => {
                console.error('Failed to copy content: ', err);
                message.error('Copy failed, please select and copy manually');
            });
    };

    const handleClear = () => {
        setChatHistory([]);
        setSelectedMessageIndex(null);
        setStreamingSteps([]);
        llmService.clearHistory();
    };

    const handleMessageClick = (index) => {
        if (chatHistory[index].role === 'assistant') {
            setSelectedMessageIndex(index);
        }
    };

    const handleExampleClick = async (query) => {
        if (isLoading) return;

        const newMessage = {
            role: 'user',
            content: query,
            references: []
        };

        setChatHistory(prev => [...prev, newMessage]);
        setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            const conversationHistory = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            conversationHistory.push({
                role: newMessage.role,
                content: newMessage.content
            });

            await llmService.chat(query, (update) => {
                switch (update.type) {
                    case 'step':
                        setStreamingSteps(prev => {
                            const newSteps = [...prev];
                            const cleanContent = update.content.replace(/\u001b\[\d+m/g, '').trim();
                            if (cleanContent) {
                                newSteps.push({
                                    step: update.step,
                                    content: cleanContent
                                });
                            }
                            return newSteps;
                        });
                        break;
                    case 'final':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                steps: streamingSteps
                            };
                            newHistory.push(assistantMessage);

                            llmService.updateMessages(update.answer);

                            return newHistory;
                        });
                        setSelectedMessageIndex(chatHistory.length + 1);
                        break;
                    case 'error':
                        setIsProcessing(false);
                        setChatHistory(prev => [...prev, {
                            role: 'assistant',
                            content: `Error: ${update.error}`,
                            references: [],
                            steps: []
                        }]);
                        break;
                }
            }, conversationHistory);
        } catch (error) {
            console.error('Error in chat:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                references: [],
                steps: []
            }]);
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const handleRegenerateResponse = (userMessageIndex) => {
        if (isLoading) return;

        const userMessage = chatHistory[userMessageIndex];

        const newChatHistory = chatHistory.slice(0, userMessageIndex + 1);
        setChatHistory(newChatHistory);

        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            const conversationHistory = newChatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            llmService.chat(userMessage.content, (update) => {
                switch (update.type) {
                    case 'step':
                        setStreamingSteps(prev => {
                            const newSteps = [...prev];
                            const cleanContent = update.content.replace(/\u001b\[\d+m/g, '').trim();
                            if (cleanContent) {
                                newSteps.push({
                                    step: update.step,
                                    content: cleanContent
                                });
                            }
                            return newSteps;
                        });
                        break;
                    case 'final':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                steps: streamingSteps
                            };
                            return [...prev, assistantMessage];
                        });
                        setSelectedMessageIndex(userMessageIndex + 1);
                        break;
                    case 'error':
                        setIsProcessing(false);
                        setChatHistory(prev => [...prev, {
                            role: 'assistant',
                            content: `Error: ${update.error}`,
                            references: [],
                            steps: []
                        }]);
                        break;
                }
            }, conversationHistory);
        } catch (error) {
            console.error('Error in regenerate:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while regenerating the response. Please try again.',
                references: [],
                steps: []
            }]);
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const MessageCard = ({ index, message, refresh, copy, edit, editContent, change, save, cancel, goref, GetSteps }) => {
        const isAssistant = message.role === "assistant";
        const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'user';
        const isEditing = index === editingMessageIndex;
        const isLoading = isProcessing && isLastUserMessage;
        const messageID = index;
        // const liked = message.like;
        // const disliked = message.dislike;
        // const bookmarked = message.bookmark;
        const tokenCount = 0;
        const timestamp = "00:00 PM";

        return (
            <Container className="message-pair" sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", mb: 2, width: "100%" }}>
                {!isAssistant && (
                    <Box sx={{ flex: "0 0 auto", width: "80px", textAlign: "right" }}>
                        <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText" }}>{timestamp}</Typography>
                    </Box>
                )}
                <Box
                    sx={{
                        bgcolor: isAssistant ? "white" : "#d9f3ee", // Different background colors
                        display: "flex",
                        alignItems: "flex-start",
                        px: "24px",
                        pt: "12px",
                        pb: "6px",
                        border: isAssistant ? "1px solid" : "none",
                        borderColor: "divider",
                        borderRadius: "24px",
                        flex: 1, // Occupy maximum width
                        // Added shadow effect
                    }}
                >
                    {isAssistant && (
                        <Box
                            sx={{
                                m: 2,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                borderStyle: "solid",
                                borderColor: "black",
                                borderWidth: 1,
                                justifyContent: "center",
                                alignItems: "center",
                                display: "flex",
                            }}
                        >
                            <img src={systemIcon} alt="Assistant" width="26" height="26" style={{ borderRadius: 13 }} />
                        </Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                        {isAssistant && (
                            <Typography variant="body2" color="textSecondary" sx={{
                                fontFamily: "Inter", fontSize: "14px", display: "flex", color: "#19213d", alignItems: "center",
                                pt: "12px", fontWeight: 500
                            }}>
                                LanguageGUI
                                <Box
                                    component="span"
                                    sx={{
                                        mx: 1,
                                        width: "1px",
                                        height: "1em",
                                        bgcolor: "text.secondary",
                                    }}
                                />
                                {timestamp}
                            </Typography>
                        )}

                        <Box mt={1}>
                            {isLoading ? (<>
                                <Box display="flex" justifyContent="center" py={2}>
                                    <CircularProgress size={24} />
                                </Box>
                                <GetSteps />
                            </>
                            ) :
                                isEditing ?
                                    <TextField
                                        hiddenLabel
                                        multiline
                                        id="filled-hidden-label-small"
                                        value={editContent}
                                        variant="filled"
                                        size="small"
                                        sx={{ flex: 1, width: "100%" }}
                                        onChange={(e) => change(e.target.value)}
                                    /> : (
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
                                    )}
                        </Box>

                        {/* Buttons below message */}
                        {isAssistant ? <Box sx={{ justifyContent: "space-between", direction: "row", display: "flex", alignItems: "center", mt: 2 }}>
                            <Stack direction="row" spacing={1} mt={2} sx={{ pb: "8px" }}>
                                <IconButton size="small" onClick={() => refresh(messageID - 1)}>
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => copy(message.content)}>
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                                {/* <IconButton size="small" onClick={()=>{}}>
                                    <ShareIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={()=>{}}>
                                    {0 ? <ThumbUpAltIcon fontSize="small" /> : <ThumbUpOffAltIcon fontSize="small" />}
                                </IconButton>
                                <IconButton size="small" onClick={()=>{}}>
                                    {0 ? <ThumbDownAltIcon fontSize="small" /> : <ThumbDownOffAltIcon fontSize="small" />}
                                </IconButton>
                                <IconButton size="small" onClick={()=>{}}>
                                    {0 ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                                </IconButton> */}
                                <IconButton size="small" onClick={() => goref(messageID)}>
                                    <FilePresentIcon fontSize="small" />
                                </IconButton>
                                {/* <IconButton size="small">
                                    <MoreHorizIcon fontSize="small" />
                                </IconButton> */}
                            </Stack>
                            <Box sx={{
                                px: "10px",
                                height: "40px",
                                borderRadius: "4px",
                                border: "none",
                                bgcolor: "#f7f8fa",
                                justifyContent: "center",
                                alignItems: "center",
                                display: "flex",
                                //boxShadow: "0px 1px 1px rgba(0, 0, 0, 0.1)",
                            }}>{tokenCount} tokens</Box>
                        </Box>
                            : <Box sx={{ justifyContent: "flex-end", direction: "row", display: "flex", alignItems: "center", mt: 2 }}>
                                <Stack direction="row" spacing={1} sx={{ pb: "8px" }}>
                                    {
                                        isEditing ? <>
                                            <IconButton size="small" onClick={() => cancel()}>
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => save(messageID)}>
                                                <CheckIcon fontSize="small" />
                                            </IconButton>
                                        </> : <>
                                            <IconButton size="small" onClick={() => copy(message.content)}>
                                                <ContentCopyIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => edit(messageID)}>
                                                <EditNoteIcon fontSize="small" />
                                            </IconButton>
                                        </>
                                    }

                                </Stack>
                            </Box>}
                    </Box>
                </Box>
            </Container>
        );
    };

    const renderMessages = () => {
        return (<Box sx={{ p: 2 }}>{chatHistory.map((message, index) => {
            // return (
            //     <MessageCard
            //         index={index}
            //         message={message}
            //         refresh={handleRegenerateResponse}
            //         copy={handleCopyMessage}
            //         edit={handleEditMessage}
            //         editContent={editedMessageContent}
            //         change={setEditedMessageContent}
            //         save={handleSaveEdit}
            //         cancel={handleCancelEdit}
            //         goref={handleMessageClick}
            //         GetSteps={() => {
            //             return (
            //                 <Box sx={{ mt: 2 }}>
            //                     {streamingSteps.map((step, stepIndex) => (
            //                         <div key={stepIndex} className="step-item">
            //                             <strong>{step.step}: </strong>
            //                             <span>{step.content}</span>
            //                         </div>
            //                     ))}
            //                 </Box>
            //             );
            //         }}
            //     />
            // );
            //return as function
            return MessageCard({
                index: index,
                message: message,
                refresh: handleRegenerateResponse,
                copy: handleCopyMessage,
                edit: handleEditMessage,
                editContent: editedMessageContent,
                change: setEditedMessageContent,
                save: handleSaveEdit,
                cancel: handleCancelEdit,
                goref: handleMessageClick,
                GetSteps: () => {
                    return (
                        <Box sx={{ mt: 2 }}>
                            {streamingSteps.map((step, stepIndex) => (
                                <div key={stepIndex} className="step-item">
                                    <strong>{step.step}: </strong>
                                    <span>{step.content}</span>
                                </div>
                            ))}
                        </Box>
                    );
                }
            });
        })}</Box>);
    };


    return (
        <div className="result-container">
            <div className="navbar-wrapper">
                <NavBarWhite />
            </div>
            <div className="main-content">
                <div className='result-content'>
                    <div className="llm-agent-container">
                        <div className="chat-and-references">
                            <div className="chat-container">

                                {/* Add example queries section */}
                                {chatHistory.length === 0 && (
                                    <div className="example-queries" style={{ paddingTop: '1rem' }}>
                                        <div className="example-queries-header" style={{ gap: '1rem', marginTop: '2vh' }}>
                                            <div className="logo-container" style={{ marginBottom: '1rem' }}>
                                                <img src={systemIcon} alt="AI" className="system-icon" style={{ width: '60px', height: '60px' }} />
                                                <img src={GLKBLogo} alt="GLKB" className="glkb-logo" style={{ height: '60px' }} />
                                            </div>
                                            <h3>I can help you explore biomedical literature. Here are some examples:</h3>
                                        </div>
                                        <div className="example-query-list" style={{ marginTop: '10px', marginBottom: '10px' }}>
                                            <div className="example-query"
                                                onClick={() => handleExampleClick("Who are you?")}
                                                style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                Who are you?
                                            </div>
                                            <div className="example-query"
                                                onClick={() => handleExampleClick("What is the role of BRCA1 in breast cancer?")}
                                                style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                What is the role of BRCA1 in breast cancer?
                                            </div>
                                            <div className="example-query"
                                                onClick={() => handleExampleClick("How many articles about Alzheimer's disease are published in 2020?")}
                                                style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                How many articles about Alzheimer's disease are published in 2020?
                                            </div>
                                            <div className="example-query"
                                                onClick={() => handleExampleClick("What pathways does TP53 participate in?")}
                                                style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                What pathways does TP53 participate in?
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="messages-container">
                                    {renderMessages()}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="chat-header">
                                    <form onSubmit={handleSubmit} className="input-form">
                                        <input
                                            type="text"
                                            value={userInput}
                                            onChange={(e) => setUserInput(e.target.value)}
                                            placeholder="Ask a question about the biomedical literature..."
                                            className="message-input"
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="submit"
                                            className="send-button"
                                            disabled={isLoading || !userInput.trim()}
                                        >
                                            Send
                                        </button>
                                    </form>
                                    <Button
                                        icon={<DeleteOutlined />}
                                        onClick={handleClear}
                                        className="clear-button"
                                    >
                                        Clear History
                                    </Button>
                                </div>
                            </div>

                            <div className="references-container">
                                <h3>References</h3>
                                {selectedMessageIndex !== null && chatHistory[selectedMessageIndex]?.references.length > 0 ? (
                                    <ul className="references-list">
                                        {chatHistory[selectedMessageIndex].references.map((ref, index) => (
                                            <li key={index} className="reference-item">
                                                <h4>{ref.title}</h4>
                                                <p className="reference-metadata">
                                                    {ref.journal} ({ref.year}) | Citations: {ref.citation_count}
                                                </p>
                                                <p className="reference-authors">{ref.authors}</p>
                                                {ref.url && (
                                                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                                                        Read More on PubMed
                                                    </a>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No references available for this response.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LLMAgent; 