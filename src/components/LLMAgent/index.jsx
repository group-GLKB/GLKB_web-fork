import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import NavBarWhite from '../Units/NavBarWhite';
import { Button, message } from 'antd';
import { LLMAgentService } from '../../service/LLMAgent';
import { DeleteOutlined } from '@ant-design/icons';
import './scoped.css';
import systemIcon from '../../img/Asset 1.png';
import ReactMarkdown from 'react-markdown';
import GLKBLogo from '../../img/glkb_dark.jpg';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { Grid } from '@mui/material';

import {
    Typography,
    Box,
    CircularProgress,
    IconButton,
    Stack,
    Container,
    TextField
} from "@mui/material";
import MuiButton from "@mui/material/Button";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilePresentIcon from '@mui/icons-material/FilePresent';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
// import github.css
import './github-markdown-light.css';

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

    const handleSubmit = async (e, input = null, t = null) => {
        const inputText = input || userInput;
        console.log('Submitting:', inputText);
        e && e.preventDefault();
        if (!inputText.trim() || isLoading) return;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Create new user message
        const newMessage = {
            role: 'user',
            content: inputText,
            references: [],
            timestamp: t || timestamp
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

            // Append a blank message
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: '',
                references: [],
                timestamp: timestamp
            }]);

            await llmService.chat(inputText, (update) => {
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
                                timestamp: timestamp
                            };
                            newHistory[newHistory.length - 1] = assistantMessage;

                            // Update the LLMAgentService's internal message history
                            llmService.updateMessages(update.answer);

                            return newHistory;
                        });
                        setSelectedMessageIndex(chatHistory.length + 1);
                        break;
                    case 'error':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const errorMessage = {
                                role: 'assistant',
                                content: `Error: ${update.error}`,
                                references: [],
                                timestamp: timestamp
                            };
                            newHistory[newHistory.length - 1] = errorMessage;
                            return newHistory;
                        });
                        break;
                }
            }, conversationHistory); // Pass the conversation history to chat method
        } catch (error) {
            console.error('Error in chat:', error);
            setChatHistory(prev => {
                const newHistory = [...prev];
                const errorMessage = {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error while processing your request. Please try again.',
                    references: [],
                    timestamp: timestamp
                };
                newHistory[newHistory.length - 1] = errorMessage;
                return newHistory;
            });
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const handleEditMessage = (index) => {
        if (chatHistory[index].role !== 'user') return;

        setEditingMessageIndex(index);
        setEditedMessageContent(chatHistory[index].content);
    };

    const handleSaveEdit = async (e, index) => {
        if (editedMessageContent.trim() === '' || isLoading) return;

        const editedHistory = chatHistory.slice(0, index);
        setChatHistory(editedHistory);
        setEditingMessageIndex(null);
        setEditedMessageContent('');

        handleSubmit(e, editedMessageContent);
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

        setChatHistory(_ => []);
        handleSubmit(null, query);
    };

    const handleRegenerateResponse = (e, index) => {
        if (isLoading) return;

        const userMessage = chatHistory[index - 1];
        const newChatHistory = chatHistory.slice(0, index - 1);
        setChatHistory(newChatHistory);

        handleSubmit(e, userMessage.content, userMessage.timestamp);
    };

    const MessageCard = ({ index, message, refresh, copy, edit, editContent, change, save, cancel, goref, GetSteps }) => {
        const isAssistant = message.role === "assistant";
        const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'assistant';
        const isEditing = index === editingMessageIndex;
        const isLoading = isProcessing && isLastUserMessage;
        const messageID = index;
        // const liked = message.like;
        // const disliked = message.dislike;
        // const bookmarked = message.bookmark;
        // const tokenCount = 0;
        const timestamp = message.timestamp || "";

        return (
            <>
                <Container className="message-pair" key={index} sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", mb: "5px", justifyContent: "flex-end" }}>
                    {!isAssistant && (
                        <Box sx={{ flex: "0 0 auto", width: "80px", textAlign: "right" }}>
                            <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText" }}>{timestamp}</Typography>
                        </Box>
                    )}
                    <Box
                        sx={{
                            bgcolor: isAssistant ? "white" : "#EDF0FE", // Different background colors
                            maxWidth: isAssistant ? "100%" : "80%", // Adjust max width for assistant messages
                            display: "flex",
                            alignItems: "flex-start",
                            px: "24px",
                            pt: isAssistant ? "12px" : "0px",
                            pb: isAssistant ? "24px" : "12px",
                            border: isAssistant ? "1px solid" : "none",
                            borderColor: "divider",
                            borderRadius: "24px",
                            flex: 1, // Occupy maximum width
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
                                    fontFamily: "Inter, sans-serif", fontSize: "14px", display: "flex", color: "#19213d", alignItems: "center",
                                    pt: "12px", pb: "12px", fontWeight: 500
                                }}>
                                    LLMAgent
                                    <Box
                                        component="span"
                                        sx={{
                                            mx: 1,
                                            width: "1px",
                                            height: "1em",
                                            bgcolor: "text.secondary",
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText" }}>{timestamp}</Typography>
                                </Typography>
                            )}

                            <Box mt={1}>
                                {isLoading ? (<>
                                    <GetSteps />
                                    <Box display="flex" justifyContent="center" py={2}>
                                        <CircularProgress size={24} />
                                    </Box>
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
                                            <div className="markdown-body">
                                                <ReactMarkdown components={{
                                                    // // Add a custom style on all nodes
                                                    // p: ({ node, ...props }) => <p style={{ lineHeight: "150%" }} {...props} />,
                                                    // // h1: ({ node, ...props }) => <h1 style={{}} {...props} />,
                                                    // // h2: ({ node, ...props }) => <h2 style={{}} {...props} />,
                                                    // // h3: ({ node, ...props }) => <h3 style={{}} {...props} />,
                                                    // // ul: ({ node, ...props }) => <ul style={{}} {...props} />,
                                                    // // ol: ({ node, ...props }) => <ol style={{}} {...props} />,
                                                    // li: ({ node, ...props }) => <li style={{ lineHeight: "150%", marginTop: "5px", marginBottom: "5px" }} {...props} />
                                                }}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                            </Box>

                            {/* Buttons below message */}
                            {isAssistant && <Box sx={{ justifyContent: "space-between", direction: "row", display: "flex", alignItems: "center", mt: "5px" }}>
                                <Stack direction="row" spacing={1} mt={2} sx={{ pb: "8px" }}>
                                    <IconButton size="small" onClick={(e) => refresh(e, messageID)}>
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
                                    {/* <IconButton size="small">
                                    <MoreHorizIcon fontSize="small" />
                                </IconButton> */}
                                </Stack>
                                {/* <Box sx={{
                                px: "10px",
                                height: "40px",
                                borderRadius: "4px",
                                border: "none",
                                bgcolor: "#f7f8fa",
                                justifyContent: "center",
                                alignItems: "center",
                                display: "flex",
                            }}>{tokenCount} tokens</Box> */}
                                <MuiButton
                                    variant='contained'
                                    startIcon={<FilePresentIcon />}
                                    size="small"
                                    onClick={() => goref(messageID)}
                                    disabled={isLoading}
                                    sx={{
                                        px: "10px",
                                        height: "40px",
                                        borderRadius: "4px",
                                        border: "none", bgcolor: "#f7f8fa", color: "#19213d",
                                        "&:hover": {
                                            bgcolor: "#e1e2e4",
                                            color: "#09112d",
                                            boxShadow: index == selectedMessageIndex ? "0 0 0 1px #19213d" : "none",
                                        },
                                        boxShadow: index == selectedMessageIndex ? "0 0 0 1px #19213d" : "none",
                                        mb: "2px"
                                    }}
                                >
                                    {index == selectedMessageIndex ? <b>References</b> : <>References</>}
                                </MuiButton>

                            </Box>}

                        </Box>

                    </Box>

                </Container>
                {!isAssistant && <Box sx={{ justifyContent: "flex-end", direction: "row", display: "flex", alignItems: "center" }}>
                    <Stack direction="row" spacing={1} sx={{ pb: "8px", pr: "24px" }}>
                        {
                            isEditing ? <>
                                <IconButton size="small" onClick={() => cancel()}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => save(e, messageID)}>
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
            </>
        );
    };

    const renderMessages = () => {
        return (<Box sx={{ p: 2 }}>{chatHistory.map((message, index) => {
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
                            <Grid container columnSpacing={{sm: 2, md: 4}} sx={{ height: '100%' }}>
                                <Grid item xs={8}>
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

                                        {/* <div className="chat-header">
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
                                                <Button
                                                    icon={<DeleteOutlined />}
                                                    onClick={handleClear}
                                                    className="clear-button"
                                                    disabled={isLoading}
                                                >
                                                    Clear History
                                                </Button>
                                            </form>
                                        </div> */}
                                        <div className="chat-header">
                                            <TextField
                                                className="input-form"
                                                type="text"
                                                value={userInput}
                                                onChange={(e) => setUserInput(e.target.value)}
                                                disabled={isLoading}
                                                placeholder="Ask a question about the biomedical literature..."
                                                sx={{
                                                    height: '60px', // Increase the height of the input box
                                                    width: '100%',
                                                    '& .MuiInputBase-root': {
                                                        height: '80px', // Adjust the height of the input field
                                                        alignItems: 'center', // Center the text vertically
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'grey', // Optional: Customize border color
                                                    },
                                                }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <Box display="flex" alignItems="center">
                                                            {/* Clear Icon */}
                                                            <CloseIcon
                                                                onClick={() => {
                                                                    setUserInput(''); // Clear the input field
                                                                }}
                                                                sx={{
                                                                    color: 'grey.500',
                                                                    cursor: 'pointer',
                                                                    fontSize: '20px', // Adjust size as needed
                                                                    marginRight: '8px', // Add spacing from the SendIcon
                                                                }}
                                                            />
                                                            {/* Search Icon */}
                                                            <SendIcon
                                                                onClick={handleSubmit} // Trigger the search function
                                                                sx={{
                                                                    color: '#1976d2',
                                                                    cursor: 'pointer',
                                                                    fontSize: '30px', // Adjust size as needed
                                                                }}
                                                                disabled={isLoading || !userInput.trim()}
                                                            />
                                                        </Box>
                                                    ),
                                                }}
                                            />
                                            <Button
                                                icon={<DeleteOutlined style={{ fontSize: "20px" }} />}
                                                onClick={handleClear}
                                                className="clear-button"
                                                disabled={isLoading}
                                            >
                                                Clear History
                                            </Button>
                                        </div>
                                    </div>
                                </Grid>
                                <Grid item xs={4}>
                                    <div style={{ height: '100%', width: '100%' }}>
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
                                                                    PubMed Article {ref.url.split('/').filter(Boolean).pop()}
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
                                </Grid>
                            </Grid>


                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LLMAgent; 