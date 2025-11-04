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
import { Helmet } from 'react-helmet-async';
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
  Download as DownloadIcon,
  EditNote as EditNoteIcon,
  FilePresent as FilePresentIcon,
  RateReview as RateReviewIcon,
  Refresh as RefreshIcon,
  StopCircle as StopCircleIcon,
} from '@mui/icons-material';
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
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
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const navigate = useNavigate();

    const llmService = useMemo(() => new LLMAgentService(), []);

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

        const handleMouseOver = (e) => {
            const link = e.target.closest('a[href*="pubmed.ncbi.nlm.nih.gov"]');
            if (link && link.href) {
                const pubmedId = link.href.split('/').filter(Boolean).pop();
                setHoveredPubmedId(pubmedId);
            }
        };

        const handleMouseOut = (e) => {
            const link = e.target.closest('a[href*="pubmed.ncbi.nlm.nih.gov"]');
            if (link) {
                setHoveredPubmedId(null);
            }
        };

        container.addEventListener('mouseover', handleMouseOver);
        container.addEventListener('mouseout', handleMouseOut);

        const links = container.querySelectorAll('a');
        links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        return () => {
            container.removeEventListener('mouseover', handleMouseOver);
            container.removeEventListener('mouseout', handleMouseOut);
        };
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

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            await llmService.chat(inputText, abortControllerRef.current, (update) => {
                switch (update.type) {
                    case 'step':
                        if (update.step === 'Error') {
                            setIsProcessing(false);
                            setChatHistory(prev => {
                                const newHistory = [...prev];
                                const assistantMessage = {
                                    role: 'assistant',
                                    content: update.content,
                                    references: [],
                                    timestamp: timestamp
                                };
                                newHistory[newHistory.length - 1] = assistantMessage;

                                // Update the LLMAgentService's internal message history
                                llmService.updateMessages(update.answer);

                                return newHistory;
                            });
                            setSelectedMessageIndex(chatHistory.length + 1);
                            break;
                        }
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
                    case 'error': // unsure if this is used
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

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    const handleSaveEdit = async (e, index, content) => {
        if (content.trim() === '' || isLoading) return;
        const editedHistory = chatHistory.slice(0, index);
        setChatHistory(editedHistory);
        handleSubmit(e, content);
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

    // useEffect(() => {
    //     if (!isLoading && !isProcessing && chatHistory.length > 0) {
    //         const lastMessage = chatHistory[chatHistory.length - 1];
    //         if (lastMessage.role === 'assistant' && selectedMessageIndex === null) {
    //             const lastAssistantIndex = chatHistory.length - 1;
    //             setTimeout(() => {
    //                 setSelectedMessageIndex(lastAssistantIndex);
    //             }, 300);
    //         }
    //     }
    // }, [isLoading, isProcessing, chatHistory]);

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

    const MessageCard = ({ index, message, refresh, copy, save, goref, GetSteps, downloadConversation }) => {
        const isAssistant = message.role === "assistant";
        const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'assistant';
        const isLoading = isProcessing && isLastUserMessage;
        const messageID = index;
        const timestamp = message.timestamp || "";
        const [editContent, setEditContent] = useState('');
        const [isEditing, setIsEditing] = useState(false);

        return (
            <div className="message-card">
                <Container className="message-pair" key={index} sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", mb: "5px", justifyContent: "flex-end" }}>
                    {!isAssistant && (
                        <Box sx={{ flex: "0 0 auto", width: "80px", textAlign: "right" }}>
                            <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText", fontFamily: 'Open Sans, sans-serif' }}>{timestamp}</Typography>
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
                                    borderColor: "#0169B040",
                                    borderWidth: "2px",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    display: "flex",
                                    overflow: "hidden",
                                    transform: "translateY(-9px)",
                                }}
                            >
                                <img src={systemIcon} alt="Assistant" width="60" height="60" style={{ borderRadius: "50%" }} />
                            </Box>
                        )}
                        <Box sx={{ flex: 1 }}>
                            {isAssistant && (
                                <Typography variant="body2" color="textSecondary" sx={{
                                    fontFamily: "Open Sans, sans-serif", fontSize: "14px", display: "flex", color: "#19213d", alignItems: "center",
                                    pt: "12px", pb: "12px", fontWeight: 500
                                }}>
                                    GLKB AI
                                    <Box
                                        component="span"
                                        sx={{
                                            mx: 1,
                                            width: "1px",
                                            height: "1em",
                                            bgcolor: "text.secondary",
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ fontSize: "10", color: "GrayText", fontFamily: 'Open Sans, sans-serif' }}>{timestamp}</Typography>
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
                                            onChange={(e) => setEditContent(e.target.value)}
                                        /> : (
                                            <div className="markdown-body" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                                                <ReactMarkdown>
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
                                    {!isLoading && <IconButton size="small" onClick={() => downloadConversation(messageID)} title="Download this Q&A">
                                        <DownloadIcon fontSize="small" />
                                    </IconButton>}
                                    {isLoading && <IconButton size="small" onClick={() => { if (abortControllerRef.current) abortControllerRef.current.abort(); }}>
                                        <StopCircleIcon fontSize="small" />
                                    </IconButton>
                                    }
                                </Stack>
                                <MuiButton
                                    variant='contained'
                                    startIcon={<FilePresentIcon />}
                                    size="small"
                                    onClick={() => goref(messageID)}
                                    disabled={isLoading}
                                    sx={{
                                        px: "10px",
                                        fontFamily: 'Open Sans, sans-serif',
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
                                <IconButton size="small" onClick={() => {
                                    setIsEditing(false);
                                    setEditContent('');
                                }}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={(e) => {
                                    if (editContent.trim() === '') {
                                        return;
                                    }
                                    save(e, messageID, editContent);
                                    setIsEditing(false);
                                    setEditContent('');
                                }}>
                                    <CheckIcon fontSize="small" />
                                </IconButton>
                            </> : <div className="user-message-actions">
                                <IconButton size="small" onClick={() => copy(message.content)}>
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => {
                                    if (isAssistant) return;

                                    setIsEditing(true);
                                    setEditContent(message.content);
                                }}>
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
                save={handleSaveEdit}
                goref={handleMessageClick}
                downloadConversation={handleDownloadConversation}
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
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [hoveredPubmedId, setHoveredPubmedId] = useState(null);
    const referencesListRef = useRef(null);

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

    const handleExportReferences = () => {
        if (sortedReferences.length === 0) return;
        
        const bibTexContent = sortedReferences.map((ref, index) => {
            const pubmedId = ref.url.split('/').filter(Boolean).pop();
            const cleanTitle = ref.title.replace(/[{}]/g, '');
            const cleanAuthors = ref.authors.replace(/,/g, ' and');
            
            return `@article{pubmed${pubmedId},
  author = {${cleanAuthors}},
  title = {${cleanTitle}},
  journal = {${ref.journal}},
  year = {${ref.year}},
  note = {PubMed ID: ${pubmedId}}
}`;
        }).join('\n\n');
        
        const blob = new Blob([bibTexContent], { type: 'application/x-bibtex' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        a.download = `references_${date}_${time}.bib`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        message.success('References exported as BibTeX');
    };

    const handleCiteClick = (url) => {
        setSelectedCitation(url);
        setCiteDialogOpen(true);
    };

    const handleCloseCiteDialog = () => {
        setCiteDialogOpen(false);
        setSelectedCitation(null);
    };

    const generateCitation = (format) => {
        if (!selectedCitation) return '';
        
        const title = selectedCitation[0];
        const pubmedUrl = selectedCitation[1];
        const year = selectedCitation[3];
        const journal = selectedCitation[4];
        const authors = selectedCitation[5];
        const pubmedId = pubmedUrl.split('/').filter(Boolean).pop();
        
        switch (format) {
            case 'MLA':
                return `${authors}. "${title}." ${journal} ${year}. PubMed ID: ${pubmedId}.`;
            case 'APA':
                return `${authors} (${year}). ${title}. ${journal}. PubMed ID: ${pubmedId}.`;
            case 'Chicago':
                return `${authors}. "${title}." ${journal} (${year}). PubMed ID: ${pubmedId}.`;
            case 'Harvard':
                return `${authors} (${year}). ${title}. ${journal}. PubMed ID: ${pubmedId}.`;
            case 'Vancouver':
                return `${authors}. ${title}. ${journal}. ${year}. PubMed ID: ${pubmedId}.`;
            case 'BibTeX':
                return `@article{${pubmedId},\n  author = {${authors}},\n  title = {${title}},\n  journal = {${journal}},\n  year = {${year}},\n  note = {PubMed ID: ${pubmedId}}\n}`;
            case 'EndNote':
                return `%0 Journal Article\n%A ${authors}\n%T ${title}\n%J ${journal}\n%D ${year}\n%M ${pubmedId}`;
            default:
                return '';
        }
    };

    const handleCopyCitation = (format) => {
        const citation = generateCitation(format);
        navigator.clipboard.writeText(citation)
            .then(() => {
                message.success(`${format} citation copied to clipboard`);
            })
            .catch(err => {
                console.error('Failed to copy citation: ', err);
                message.error('Copy failed');
            });
    };

    useEffect(() => {
        if (!hoveredPubmedId || !referencesListRef.current) return;

        const targetElement = document.querySelector(`[data-pubmed-id="${hoveredPubmedId}"]`);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [hoveredPubmedId]);

    const handleDownloadConversation = (messageIndex) => {
        if (chatHistory.length === 0) return;

        const assistantMessage = chatHistory[messageIndex];
        const userMessage = messageIndex > 0 ? chatHistory[messageIndex - 1] : null;

        if (!assistantMessage || assistantMessage.role !== 'assistant') return;

        let conversationText = 'Q&A Export\n';
        conversationText += '='.repeat(50) + '\n\n';

        if (userMessage && userMessage.role === 'user') {
            conversationText += `[User] ${userMessage.timestamp || ''}\n`;
            conversationText += '-'.repeat(50) + '\n';
            conversationText += userMessage.content + '\n\n';
            conversationText += '='.repeat(50) + '\n\n';
        }

        conversationText += `[Assistant] ${assistantMessage.timestamp || ''}\n`;
        conversationText += '-'.repeat(50) + '\n';
        conversationText += assistantMessage.content + '\n';

        if (assistantMessage.references && assistantMessage.references.length > 0) {
            conversationText += '\n\nReferences:\n';
            conversationText += '-'.repeat(50) + '\n';
            assistantMessage.references.forEach((ref, refIndex) => {
                const pubmedId = ref.url.split('/').filter(Boolean).pop();
                conversationText += `[${refIndex + 1}] ${ref.authors} (${ref.year}). ${ref.title}. ${ref.journal}. PubMed ID: ${pubmedId}\n\n`;
            });
        }

        const blob = new Blob([conversationText], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        a.download = `qa_export_${date}_${time}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        message.success('Q&A downloaded');
    };

    return (
        <>
            <Helmet>
                <title>AI Chat - Genomic Literature Knowledge Base</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="AI Chat - Genomic Literature Knowledge Base | AI-Powered Genomics Search" />
            </Helmet>
            
            <Dialog 
                open={citeDialogOpen} 
                onClose={handleCloseCiteDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '12px',
                        padding: '8px'
                    }
                }}
            >
                <DialogTitle sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '20px',
                    fontWeight: '600'
                }}>
                    Cite
                    <IconButton onClick={handleCloseCiteDialog} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        {['MLA', 'APA', 'Chicago', 'Harvard', 'Vancouver'].map((format) => (
                            <Box key={format}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    mb: 1
                                }}>
                                    <Typography sx={{ 
                                        fontFamily: 'Open Sans, sans-serif',
                                        fontWeight: '600',
                                        fontSize: '14px'
                                    }}>
                                        {format}
                                    </Typography>
                                </Box>
                                <Box sx={{ 
                                    backgroundColor: '#f5f5f5',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontFamily: 'Open Sans, sans-serif',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: '#ebebeb'
                                    }
                                }}
                                onClick={() => handleCopyCitation(format)}
                                >
                                    {generateCitation(format)}
                                </Box>
                            </Box>
                        ))}
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <MuiButton
                                variant="outlined"
                                onClick={() => handleCopyCitation('BibTeX')}
                                sx={{
                                    fontFamily: 'Open Sans, sans-serif',
                                    textTransform: 'none',
                                    borderRadius: '8px',
                                    padding: '8px 24px'
                                }}
                            >
                                BibTeX
                            </MuiButton>
                            <MuiButton
                                variant="outlined"
                                onClick={() => handleCopyCitation('EndNote')}
                                sx={{
                                    fontFamily: 'Open Sans, sans-serif',
                                    textTransform: 'none',
                                    borderRadius: '8px',
                                    padding: '8px 24px'
                                }}
                            >
                                EndNote
                            </MuiButton>
                        </Box>
                    </Stack>
                </DialogContent>
            </Dialog>

            <div className="result-container">
                <div className="navbar-wrapper">
                    <NavBarWhite />
                </div>
                <Grid className="main-grid" container sx={{ marginTop: '64px', width: "unset" }} >
                    <Grid item xs={12} className="subgrid">
                        <div className="main-content">
                            {/* <MuiButton variant="text" sx={{
                                color: '#333333',
                                fontFamily: 'Open Sans, sans-serif',
                                alignSelf: 'flex-start',
                                zIndex: 1,
                                borderRadius: '24px',
                                marginTop: '16px',
                                marginBottom: '16px',
                            }}
                                onClick={() => navigate('/')}>
                                <ArrowBackIcon />Back
                            </MuiButton> */}
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
                                                            fontFamily: 'Open Sans, sans-serif',
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
                                                            color: isLoading ? '#e0e0e0' : '#64748B',
                                                            fontFamily: 'Open Sans, sans-serif',
                                                        }}>
                                                            <RateReviewIcon sx={{ fontSize: '15px' }} /> New Chat
                                                        </MuiButton>
                                                    </Box>
                                                    {/* Add example queries section */}
                                                    {chatHistory.length === 0 && (<div className='empty-components-container'>
                                                        <div className="empty-page-title" style={{ paddingTop: '1rem' }}>
                                                            <div style={{ gap: '1rem', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                                                                <Typography sx={{ fontFamily: "Open Sans, sans-serif", fontSize: '32px', fontWeight: '700', color: "#0169B0" }}>
                                                                    Explore Biomedical Literature
                                                                </Typography>
                                                                <Typography sx={{ fontFamily: "Open Sans, sans-serif", fontSize: '18px', fontWeight: '500', color: "#718096" }}>
                                                                    AI-powered Genomic Literature Knowledge Base
                                                                </Typography>
                                                            </div>
                                                        </div>
                                                        <div className="example-queries-header">
                                                            <Typography sx={{ fontFamily: "Open Sans, sans-serif", fontSize: '16px', fontWeight: '400', color: "#888888", width: '100%', textAlign: 'left' }}>
                                                                Try these example queries:
                                                            </Typography>
                                                            <div className="example-query-list" style={{ marginTop: '0px', paddingTop: '10px', minHeight: '80px' }}>
                                                                {
                                                                    ["What is the role of BRCA1 in breast cancer?",
                                                                        "How many articles about Alzheimer's disease are published in 2020?",
                                                                        "What pathways does TP53 participate in?"
                                                                    ].map((query, index) => (
                                                                        <div className="example-query" key={index} onClick={() => handleExampleClick(query)}>
                                                                            {query}
                                                                        </div>
                                                                    ))
                                                                }
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
                                                            size="small"
                                                            value={userInput}
                                                            onChange={(e) => setUserInput(e.target.value)}
                                                            disabled={isLoading}
                                                            variant="outlined"
                                                            placeholder="Ask a question about the biomedical literature..."
                                                            sx={{
                                                                backgroundColor: '#F4F9FE',
                                                                borderRadius: '30px',
                                                                minHeight: '60px', // Increase the height of the input box
                                                                '& .MuiInputBase-root': {
                                                                    height: '60px',
                                                                    borderRadius: '30px',
                                                                    alignItems: 'center', // Center the text vertically
                                                                    fontFamily: 'Open Sans, sans-serif',
                                                                    '& fieldset': {
                                                                        border: 'none'
                                                                    },
                                                                    boxShadow: '0px 2px 3px -1px #00000026',
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
                                                            <h3 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: '500', fontSize: '18px', marginBottom: '0', paddingLeft: '32px' }}>References</h3>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Select
                                                                    size="small"
                                                                    value={sortOption}
                                                                    onChange={value => setSortOption(value)}
                                                                    options={[
                                                                        { value: 'Year', label: 'Sort by Year' },
                                                                        { value: 'Citations', label: 'Sort by Citations' }
                                                                    ]}
                                                                    style={{ minWidth: '140px', fontFamily: 'Open Sans, sans-serif' }}
                                                                    styles={{ popup: { root: { 'font-family': 'Open Sans, sans-serif' } } }}
                                                                />
                                                                <IconButton 
                                                                    size="small"
                                                                    onClick={handleExportReferences}
                                                                    disabled={sortedReferences.length === 0}
                                                                    sx={{
                                                                        padding: '6px',
                                                                        marginRight: '16px',
                                                                        '&:hover': {
                                                                            backgroundColor: '#f0f0f0',
                                                                        }
                                                                    }}
                                                                    title="Export all references"
                                                                >
                                                                    <DownloadIcon sx={{ fontSize: '20px', color: sortedReferences.length === 0 ? '#ccc' : '#666' }} />
                                                                </IconButton>
                                                            </div>
                                                        </div>

                                                        {sortedReferences.length > 0 ? (
                                                            <div ref={referencesListRef} className="references-list" style={{ maxHeight: 'calc(100% - 56px)', overflowY: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
                                                                {sortedReferences.map((ref, index) => {
                                                                    const url = [
                                                                        ref.title,
                                                                        ref.url,
                                                                        ref.citation_count,
                                                                        ref.year,
                                                                        ref.journal,
                                                                        ref.authors
                                                                    ];
                                                                    const pubmedId = ref.url.split('/').filter(Boolean).pop();
                                                                    const isHighlighted = hoveredPubmedId === pubmedId;
                                                                    return (
                                                                        <div key={index} style={{ marginTop: '12px' }} data-pubmed-id={pubmedId}>
                                                                            <ReferenceCard url={url} handleClick={handleClick} onCiteClick={handleCiteClick} isHighlighted={isHighlighted} />
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
        </>
    );
}

export default LLMAgent; 