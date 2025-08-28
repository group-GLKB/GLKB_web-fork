import './scoped.css';
// import github.css
import './github-markdown-light.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  message,
  Select,
} from 'antd';
import ReactMarkdown from 'react-markdown';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  ArrowBack as ArrowBackIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Check as CheckIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  EditNote as EditNoteIcon,
  FilePresent as FilePresentIcon,
  RateReview as RateReviewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import systemIcon from '../../img/LLM_logo.jpg';
import { LLMAgentService } from '../../service/LLMAgent';
import NavBarWhite from '../Units/NavBarWhite';
import ReferenceCard from '../Units/ReferenceCard/ReferenceCard';
import SearchButton from '../Units/SearchButton/SearchButton';

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
    const navigate = useNavigate();

    // Create a single instance of LLMAgentService that persists across re-renders
    const llmService = React.useMemo(() => new LLMAgentService(), []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
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

    useEffect(() => {
        const container = document.querySelector('.chat-container');
        if (!container) return;

        const links = container.querySelectorAll('a');
        links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    }, [chatHistory]);

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
            <div className="message-card">
                <Container className="message-pair" key={index} sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", mb: "5px", justifyContent: "flex-end" }}>
                    {!isAssistant && (
                        <Box sx={{ flex: "0 0 auto", width: "80px", textAlign: "right" }}>
                            <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText" }}>{timestamp}</Typography>
                        </Box>
                    )}
                    <Box
                        sx={{
                            bgcolor: isAssistant ? "white" : "#EDF5FE", // Different background colors
                            maxWidth: isAssistant ? "100%" : "80%", // Adjust max width for assistant messages
                            display: "flex",
                            alignItems: "flex-start",
                            px: isAssistant ? "0px" : "24px",
                            pt: isAssistant ? "12px" : "0px",
                            pb: isAssistant ? "24px" : "12px",
                            // border: isAssistant ? "1px solid" : "none",
                            borderColor: "divider",
                            borderRadius: "24px",
                            flex: 1, // Occupy maximum width
                        }}
                    >
                        {isAssistant && (
                            <Box
                                sx={{
                                    m: 2,
                                    ml: 0,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    borderStyle: "solid",
                                    borderColor: "#0169B0",
                                    borderWidth: "2px",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    display: "flex",
                                    overflow: "hidden",
                                }}
                            >
                                <img src={systemIcon} alt="Assistant" width="60" height="60" style={{ borderRadius: "50%" }} />
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
                            </> : <div className="user-message-actions">
                                <IconButton size="small" onClick={() => copy(message.content)}>
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => edit(messageID)}>
                                    <EditNoteIcon fontSize="small" />
                                </IconButton>
                            </div>
                        }

                    </Stack>
                </Box>}
            </div>
        );
    };

    const renderMessages = () => {
        return (<Box sx={{ p: 2 }}>{chatHistory.map((message, index) => (
            <MessageCard
                key={index}
                index={index}
                message={message}
                refresh={handleRegenerateResponse}
                copy={handleCopyMessage}
                edit={handleEditMessage}
                editContent={editedMessageContent}
                change={setEditedMessageContent}
                save={handleSaveEdit}
                cancel={handleCancelEdit}
                goref={handleMessageClick}
                GetSteps={() => (
                    <Box sx={{ mt: 2 }}>
                        {streamingSteps.map((step, stepIndex) => (
                            <div key={stepIndex} className="step-item">
                                <strong>{step.step}: </strong>
                                <span>{step.content}</span>
                            </div>
                        ))}
                    </Box>
                )}
            />
        ))}</Box>);
    };

    const [sortOption, setSortOption] = useState('Year');

    const references = selectedMessageIndex !== null
        ? chatHistory[selectedMessageIndex]?.references || []
        : [];

    const sortedReferences = useMemo(() => {
        const sorted = [...references];
        if (sortOption === 'Citations') {
            sorted.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
        } else {
            sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
        }
        return sorted;
    }, [references, sortOption]);

    return (
        <div className="result-container">
            <div className="navbar-wrapper">
                <NavBarWhite />
            </div>
            <Grid className="main-grid" container sx={{ marginTop: '40px', width: "unset" }} >
                <Grid item xs={12} className="subgrid">
                    <div className="main-content">
                        <MuiButton variant="text" sx={{
                            color: '#333333',
                            alignSelf: 'flex-start',
                            zIndex: 1,
                            borderRadius: '24px',
                            // transform: 'translateY(-10px)',
                        }}
                            onClick={() => navigate('/')}>
                            <ArrowBackIcon />Back
                        </MuiButton>
                        <div className='result-content'>
                            <div className="llm-agent-container">
                                <div className="chat-and-references">
                                    <Grid container spacing={'48px'}>
                                        <Grid item xs={7} height={"100%"}>
                                            <div className="chat-container">
                                                <Box className="llm-header" sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '16px',
                                                    height: '55px',
                                                    borderBottom: '1px solid #E6E6E6',
                                                    marginBottom: '1px',
                                                }}>
                                                    <Typography sx={{
                                                        fontFamily: 'Inter, sans-serif',
                                                        fontSize: '18px',
                                                        fontWeight: '500',
                                                        paddingLeft: '16px',
                                                    }}>
                                                        AI Chat
                                                    </Typography>
                                                    <MuiButton onClick={handleClear} disabled={isLoading || chatHistory.length === 0} sx={{
                                                        width: 92,
                                                        height: 26,
                                                        borderRadius: "4px",
                                                        borderWidth: "1px",
                                                        padding: "4px",
                                                        gap: "4px",
                                                        border: "1px solid #E2E8F0",
                                                        fontSize: '11px',
                                                        color: isLoading ? '#e0e0e0' : '#64748B'
                                                    }}>
                                                        <RateReviewIcon sx={{ fontSize: '15px' }} /> New Chat
                                                    </MuiButton>
                                                </Box>
                                                {/* Add example queries section */}
                                                {chatHistory.length === 0 && (<>
                                                    <div className="empty-page-title" style={{ paddingTop: '1rem' }}>
                                                        <div style={{ gap: '1rem', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                                                            <Typography sx={{ fontFamily: "Inter, sans-serif", fontSize: 'clamp(0.5vw, 32px, 2vw)', fontWeight: '700', color: "#0169B0" }}>
                                                                Explore Biomedical Literature
                                                            </Typography>
                                                            <Typography sx={{ fontFamily: "Inter, sans-serif", fontSize: 'clamp(0.25vw, 18px, 1.1vw)', fontWeight: '500', color: "#718096" }}>
                                                                AI-powered Genomic Literature Knowledge Base
                                                            </Typography>
                                                        </div>
                                                    </div>
                                                    <div className="example-queries-header">
                                                        <Typography sx={{ fontFamily: "Inter, sans-serif", fontSize: '16px', fontWeight: '400', color: "#888888", width: '100%', textAlign: 'left' }}>
                                                            Try these example queries:
                                                        </Typography>
                                                        <div className="example-query-list" style={{ marginTop: '0px', paddingTop: '10px', minHeight: '80px' }}>
                                                            <div className="example-query"
                                                                onClick={() => handleExampleClick("What is the role of BRCA1 in breast cancer?")}>
                                                                What is the role of BRCA1 in breast cancer?
                                                            </div>
                                                            <div className="example-query"
                                                                onClick={() => handleExampleClick("How many articles about Alzheimer's disease are published in 2020?")}>
                                                                How many articles about Alzheimer's disease are published in 2020?
                                                            </div>
                                                            <div className="example-query"
                                                                onClick={() => handleExampleClick("What pathways does TP53 participate in?")}>
                                                                What pathways does TP53 participate in?
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
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
                                                        size="small"
                                                        value={userInput}
                                                        onChange={(e) => setUserInput(e.target.value)}
                                                        disabled={isLoading}
                                                        variant="outlined"
                                                        placeholder="Ask a question about the biomedical literature..."
                                                        sx={{
                                                            backgroundColor: '#F9FBFF',
                                                            borderRadius: '30px',
                                                            minHeight: '60px', // Increase the height of the input box
                                                            '& .MuiInputBase-root': {
                                                                height: '60px',
                                                                borderRadius: '30px',
                                                                alignItems: 'center', // Center the text vertically
                                                                '& fieldset': {
                                                                    border: 'none'
                                                                },
                                                                boxShadow: '0px 2px 4px -1px #00000026',
                                                            },
                                                            '& .MuiInputBase-input': {
                                                                paddingLeft: '4px',
                                                            },
                                                            '& .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: 'grey', // Optional: Customize border color
                                                            },
                                                            "& .MuiOutlinedInput-root": {
                                                                paddingLeft: "0px!important",
                                                                paddingRight: "70px!important",
                                                            },
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <ChatBubbleOutlineIcon sx={{ color: '#a1a1a1', marginLeft: '25px', marginRight: '5px', fontSize: '20px' }} />
                                                            ),
                                                            endAdornment: (
                                                                <Box
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 1,
                                                                        justifyContent: 'center',
                                                                        position: 'absolute',
                                                                        right: 0,
                                                                        height: '100%', // Ensure alignment with TextField height
                                                                    }}
                                                                >
                                                                    {/* Clear Icon */}
                                                                    {userInput !== "" && <CloseIcon
                                                                        className="close-button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setUserInput('');
                                                                        }}
                                                                        sx={{
                                                                            color: 'grey.500',
                                                                            cursor: 'pointer',
                                                                            fontSize: '20px', // Adjust size as needed 
                                                                        }}
                                                                    />}
                                                                    {/* Search Icon */}
                                                                    <SearchButton
                                                                        alterColor={1}
                                                                        onClick={() => {
                                                                            handleSubmit();
                                                                        }}
                                                                        disabled={isLoading || !userInput.trim()}
                                                                    />
                                                                </Box>
                                                            ),
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && userInput !== "" && !isLoading) {
                                                                e.preventDefault();
                                                                handleSubmit();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </Grid>
                                        <Grid item xs={5} height={"100%"}>
                                            <div style={{ height: '100%', width: '100%' }}>
                                                <div className="references-container">
                                                    <div style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        height: '55px',
                                                        borderBottom: '1px solid #E6E6E6',
                                                        marginBottom: '1px',
                                                    }}>
                                                        <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '18px', marginBottom: '0' }}>References</h3>
                                                        <Select
                                                            size="small"
                                                            value={sortOption}
                                                            onChange={value => setSortOption(value)}
                                                            options={[
                                                                { value: 'Year', label: 'Sort by Year' },
                                                                { value: 'Citations', label: 'Sort by Citations' }
                                                            ]}
                                                            style={{ marginRight: '16px', minWidth: '140px' }}
                                                        />
                                                    </div>

                                                    {sortedReferences.length > 0 ? (
                                                        <div className="references-list" style={{ maxHeight: 'calc(100% - 56px)', overflowY: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
                                                            {sortedReferences.map((ref, index) => {
                                                                const url = [
                                                                    ref.title,
                                                                    ref.url,
                                                                    ref.citation_count,
                                                                    ref.year,
                                                                    ref.journal,
                                                                    ref.authors
                                                                ];
                                                                return (
                                                                    <div key={index} style={{ marginTop: '12px' }}>
                                                                        <ReferenceCard url={url} handleClick={handleClick} />
                                                                        <hr style={{ border: 'none', height: '1px', backgroundColor: 'rgba(5, 5, 5, 0.06)', marginTop: '12px' }} />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p style={{ padding: '16px 32px' }}>No references available for this response.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Grid>
                                    </Grid>


                                </div>
                            </div>
                        </div>
                    </div>
                </Grid>
            </Grid>
        </div>
    );
}

export default LLMAgent; 