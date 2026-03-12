import './scoped.css';
// import github.css
import './github-markdown-light.css';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { message } from 'antd';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  EditNote as EditNoteIcon,
  ExpandMore as ExpandMoreIcon,
  FilePresent as FilePresentIcon,
  StopCircle as StopCircleIcon,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import contentCopyIcon from '../../img/llm/content_copy.svg';
import { ReactComponent as DownloadIcon } from '../../img/llm/download_2.svg';
import replayIcon from '../../img/llm/replay.svg';
import { ReactComponent as AddIcon } from '../../img/navbar/add.svg';
import { LLMAgentService } from '../../service/LLMAgent';
import {
  createConversation,
  getActiveConversationId,
  getConversations,
  migrateLegacyChatHistory,
  setActiveConversationId,
  setConversations,
  updateConversationMessages,
  upsertConversation,
} from '../../utils/chatHistory';
import CiteDialog from '../Units/CiteDialog';
import NavBarWhite from '../Units/NavBarWhite';
import ReferenceCard from '../Units/ReferenceCard/ReferenceCard';
import ChatSearchBar from './ChatSearchBar';

const formatDuration = (durationMs) => {
    if (durationMs === null || durationMs === undefined) return '';
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};

const logDev = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(...args);
    }
};

const getStoredChatHistory = () => {
    if (typeof window === 'undefined') return [];
    const conversations = getConversations();
    const activeId = getActiveConversationId();
    const active = conversations.find((item) => item.id === activeId);
    return active?.messages || [];
};

const getStoredProcessingFlag = () => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('llmWasProcessing') === 'true';
};

const getStoredIncompleteFlag = () => {
    if (typeof window === 'undefined') return false;
    try {
        const parsed = getStoredChatHistory();
        if (!Array.isArray(parsed) || parsed.length === 0) return false;
        const lastMessage = parsed[parsed.length - 1];
        return lastMessage?.role === 'assistant' && !lastMessage?.content;
    } catch (error) {
        return false;
    }
};

const STEP_LABELS = {
    'agent.AGENT_START': 'Agent Start',
    load_skill: 'Load Skill',
    article_search: 'Article Search',
    search_pubmed: 'Search PubMed',
    get_database_schema: 'Get Database Schema',
    vocabulary_search: 'Vocabulary Search',
    execute_cypher: 'Execute Cypher',
    fetch_abstract: 'Fetch Abstract',
    'agent.AGENT_INPUT': 'Agent Input',
    'agent.AGENT_OUTPUT': 'Agent Output',
};

const LEFT_MIN_PX = 360;
const RIGHT_MIN_PX = 360;
const DIVIDER_PX = 8;
const DEFAULT_LEFT_PERCENT = 66;
const FALLBACK_MIN_LEFT_PERCENT = 45;
const FALLBACK_MAX_LEFT_PERCENT = 80;
const FALLBACK_COLLAPSE_THRESHOLD = 84;

const areMessagesEqual = (left, right) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;

    for (let i = 0; i < left.length; i += 1) {
        const leftMsg = left[i];
        const rightMsg = right[i];
        const leftSignature = JSON.stringify({
            role: leftMsg?.role,
            content: leftMsg?.content,
            timestamp: leftMsg?.timestamp,
            references: leftMsg?.references,
            thinkingSteps: leftMsg?.thinkingSteps,
            thoughtDurationMs: leftMsg?.thoughtDurationMs,
        });
        const rightSignature = JSON.stringify({
            role: rightMsg?.role,
            content: rightMsg?.content,
            timestamp: rightMsg?.timestamp,
            references: rightMsg?.references,
            thinkingSteps: rightMsg?.thinkingSteps,
            thoughtDurationMs: rightMsg?.thoughtDurationMs,
        });
        if (leftSignature !== rightSignature) return false;
    }

    return true;
};

const getStepLabel = (stepName) => STEP_LABELS[stepName] || stepName;

const ThoughtLine = React.memo(function ThoughtLine({ line, lineKey }) {
    return (
        <Typography
            sx={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 400,
                color: '#5B5B5B',
                whiteSpace: 'pre-wrap',
            }}
            data-line-key={lineKey}
        >
            {line}
        </Typography>
    );
});

const ThoughtGroup = React.memo(
    function ThoughtGroup({
        group,
        groupIndex,
        expanded,
        onToggle,
        disableAnimation = false,
        disableToggle = false,
    }) {
        const hasLines = group.lines.length > 0;
        return (
            <Box>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <Typography sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#164563',
                    }}>
                        {getStepLabel(group.name)}
                    </Typography>
                    {hasLines && !disableToggle && (
                        <IconButton
                            size="small"
                            onClick={() => onToggle(groupIndex)}
                            aria-label={`Toggle ${group.name} details`}
                            sx={{ padding: '2px' }}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    fontSize: '16px',
                                    color: '#646464',
                                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: disableAnimation ? 'none' : 'transform 0.2s ease',
                                }}
                            />
                        </IconButton>
                    )}
                </Box>
                {expanded && hasLines && (
                    <Box sx={{
                        mt: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        borderLeft: '2px solid #D9D9D9',
                        pl: '10px',
                    }}>
                        {group.lines.map((line, lineIndex) => (
                            <ThoughtLine
                                key={`${group.name}-${lineIndex}`}
                                line={line}
                                lineKey={`${group.name}-${lineIndex}`}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        );
    },
    (prev, next) => (
        prev.group === next.group
        && prev.expanded === next.expanded
        && prev.disableToggle === next.disableToggle
    )
);

const parseThinkingEntry = (entry) => {
    const raw = entry?.content ?? '';
    const trimmed = raw.trim();
    if (!trimmed) {
        return { stepName: 'Step', line: raw };
    }

    let action = '';
    let rest = trimmed;
    const match = trimmed.match(/^\s*\[([^\]]+)\]\s*([\s\S]*)$/);
    if (match) {
        action = match[1].trim();
        rest = match[2].trim();
    }

    let stepName = rest;
    let detail = '';
    if (rest.includes('|')) {
        const parts = rest.split('|');
        stepName = parts.shift().trim();
        detail = parts.join('|').trim();
    }

    if (!stepName) {
        stepName = action || 'Step';
    }

    if (stepName === 'GLKBAgent' && action) {
        const actionKey = action.trim().replace(/\s+/g, '_').toUpperCase();
        stepName = `agent.${actionKey}`;
    }

    return { stepName, line: raw };
};

const groupThinkingSteps = (steps) => {
    if (!Array.isArray(steps)) return [];
    const groups = [];

    steps.forEach((entry) => {
        const { stepName, line } = parseThinkingEntry(entry);
        if (groups.length === 0 || groups[groups.length - 1].name !== stepName) {
            groups.push({ name: stepName, lines: line ? [line] : [] });
        } else if (line) {
            groups[groups.length - 1].lines.push(line);
        }
    });

    return groups;
};

function LLMAgent() {
    const location = useLocation();
    const [userInput, setUserInput] = useState('');
    const [chatHistory, setChatHistory] = useState(getStoredChatHistory);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingGroups, setStreamingGroups] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [leftPaneWidth, setLeftPaneWidth] = useState(66);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);
    const [dragIndicatorY, setDragIndicatorY] = useState(0);
    const [isReferencesCollapsed, setIsReferencesCollapsed] = useState(false);
    const [, setConversationsState] = useState(() => getConversations());
    const [activeConversationId, setActiveConversationIdState] = useState(() => getActiveConversationId());
    const [showReloadPrompt, setShowReloadPrompt] = useState(
        () => getStoredProcessingFlag() || getStoredIncompleteFlag()
    );
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const thinkingStepsRef = useRef([]);
    const prevSelectedMessageIndexRef = useRef(null);
    const hasConsumedInitialQueryRef = useRef(false);
    const activeConversationIdRef = useRef(getActiveConversationId());
    const splitContainerRef = useRef(null);
    const isDraggingSplitRef = useRef(false);
    const navigate = useNavigate();

    const llmService = useMemo(() => new LLMAgentService(), []);

    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    useEffect(() => {
        const migrated = migrateLegacyChatHistory();
        const stored = migrated.length ? migrated : getConversations();
        let nextActiveId = getActiveConversationId();

        if (!nextActiveId && stored.length > 0) {
            nextActiveId = stored[0].id;
            setActiveConversationId(nextActiveId);
        }

        setConversationsState(stored);
        setActiveConversationIdState(nextActiveId || null);
        activeConversationIdRef.current = nextActiveId || null;

        if (nextActiveId) {
            const active = stored.find((item) => item.id === nextActiveId);
            setChatHistory(active?.messages || []);
        }
    }, []);

    useEffect(() => {
        const conversationId = location.state?.conversationId;
        if (!conversationId) return;

        const stored = getConversations();
        const active = stored.find((item) => item.id === conversationId);
        if (!active) return;

        setConversationsState(stored);
        setActiveConversationId(conversationId);
        setActiveConversationIdState(conversationId);
        activeConversationIdRef.current = conversationId;
        setChatHistory(active.messages || []);
        setSelectedMessageIndex(null);
        setShowReloadPrompt(false);
        llmService.clearHistory();
    }, [location.state, llmService]);

    const startNewConversation = useCallback(() => {
        setChatHistory([]);
        setSelectedMessageIndex(null);
        setStreamingGroups([]);
        thinkingStepsRef.current = [];
        setShowReloadPrompt(false);
        setActiveConversationIdState(null);
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        llmService.clearHistory();
    }, [llmService]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, streamingGroups]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem('llmChatHistory', JSON.stringify(chatHistory));
    }, [chatHistory]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem('llmWasProcessing', isProcessing ? 'true' : 'false');
    }, [isProcessing]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handlePageShow = (event) => {
            if (event.persisted && isProcessing) {
                setShowReloadPrompt(true);
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, [isProcessing]);

    useEffect(() => {
        if (location.state && location.state.initialQuery && !hasConsumedInitialQueryRef.current) {
            hasConsumedInitialQueryRef.current = true;
            const query = location.state.initialQuery;
            if (!isLoading) {
                startNewConversation();
                handleSubmit(null, query, null, { forceNewConversation: true });
            }
        }
    }, [location.state, isLoading, startNewConversation]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!activeConversationIdRef.current) return;
        const currentList = getConversations();
        const active = currentList.find((item) => item.id === activeConversationIdRef.current);
        const storedMessages = active?.messages || [];
        if (areMessagesEqual(storedMessages, chatHistory)) return;
        const nextList = updateConversationMessages(
            currentList,
            activeConversationIdRef.current,
            chatHistory
        );
        setConversationsState(nextList);
        setConversations(nextList);
    }, [chatHistory]);

    const collapseReferences = useCallback((widthToStore) => {
        if (isReferencesCollapsed) return;
        const nextWidth = Number.isFinite(widthToStore) ? widthToStore : leftPaneWidth;
        setLeftPaneWidth(100);
        setIsReferencesCollapsed(true);
    }, [isReferencesCollapsed, leftPaneWidth]);

    const expandReferences = useCallback(() => {
        let nextWidth = DEFAULT_LEFT_PERCENT;

        if (splitContainerRef.current) {
            const rect = splitContainerRef.current.getBoundingClientRect();
            const availableWidth = Math.max(1, rect.width - DIVIDER_PX);
            const minLeftPercent = Math.min(100, (LEFT_MIN_PX / availableWidth) * 100);
            const maxLeftPercent = Math.max(0, 100 - (RIGHT_MIN_PX / availableWidth) * 100);
            const safeMin = Math.min(minLeftPercent, maxLeftPercent);
            const safeMax = Math.max(minLeftPercent, maxLeftPercent);
            nextWidth = Math.min(safeMax, Math.max(safeMin, nextWidth));
        } else {
            nextWidth = Math.min(FALLBACK_MAX_LEFT_PERCENT, Math.max(FALLBACK_MIN_LEFT_PERCENT, nextWidth));
        }

        setLeftPaneWidth(nextWidth);
        setIsReferencesCollapsed(false);
    }, []);

    const updateSplitWidth = useCallback((clientX) => {
        if (!splitContainerRef.current) return;
        if (isReferencesCollapsed) return;
        const rect = splitContainerRef.current.getBoundingClientRect();
        const availableWidth = Math.max(1, rect.width - DIVIDER_PX);
        const offset = clientX - rect.left;
        const nextWidth = (offset / rect.width) * 100;
        const minLeftPercent = Math.min(100, (LEFT_MIN_PX / availableWidth) * 100);
        const maxLeftPercent = Math.max(0, 100 - (RIGHT_MIN_PX / availableWidth) * 100);
        const safeMin = Math.min(minLeftPercent, maxLeftPercent);
        const safeMax = Math.max(minLeftPercent, maxLeftPercent);
        const collapseThreshold = Math.min(FALLBACK_COLLAPSE_THRESHOLD, safeMax + 2);

        if (nextWidth >= collapseThreshold) {
            const clamped = Math.min(safeMax, Math.max(safeMin, nextWidth));
            collapseReferences(clamped);
            return;
        }
        const clamped = Math.min(safeMax, Math.max(safeMin, nextWidth));
        setLeftPaneWidth(clamped);
    }, [collapseReferences, isReferencesCollapsed]);

    const updateSplitIndicator = useCallback((clientY) => {
        if (!splitContainerRef.current) return;
        const rect = splitContainerRef.current.getBoundingClientRect();
        const offset = clientY - rect.top;
        const clamped = Math.min(rect.height, Math.max(0, offset));
        setDragIndicatorY(clamped);
    }, []);

    const handleSplitMouseDown = (event) => {
        if (isReferencesCollapsed) return;
        event.preventDefault();
        isDraggingSplitRef.current = true;
        setIsDraggingSplit(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        updateSplitWidth(event.clientX);
        updateSplitIndicator(event.clientY);
    };

    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!isDraggingSplitRef.current) return;
            updateSplitWidth(event.clientX);
            updateSplitIndicator(event.clientY);
        };

        const handleMouseUp = () => {
            if (!isDraggingSplitRef.current) return;
            isDraggingSplitRef.current = false;
            setIsDraggingSplit(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [updateSplitWidth, updateSplitIndicator]);


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

    const handleSubmit = async (e, input = null, t = null, options = {}) => {
        const inputText = input || userInput;
        e && e.preventDefault();
        if (!inputText.trim() || isLoading) return;

        const shouldStartNewConversation = options.forceNewConversation || !activeConversationIdRef.current;
        const baseHistory = shouldStartNewConversation ? [] : chatHistory;

        setShowReloadPrompt(false);

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const requestStartedAt = Date.now();

        // Create new user message
        const newMessage = {
            role: 'user',
            content: inputText,
            references: [],
            timestamp: t || timestamp
        };

        if (shouldStartNewConversation) {
            const conversation = createConversation([...baseHistory, newMessage]);
            const nextList = upsertConversation(getConversations(), conversation);
            setConversationsState(nextList);
            setConversations(nextList);
            setActiveConversationIdState(conversation.id);
            activeConversationIdRef.current = conversation.id;
            setActiveConversationId(conversation.id);
        }

        // Update chat history with user message
        setChatHistory([...baseHistory, newMessage]);
        setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingGroups([]);
        thinkingStepsRef.current = [];

        try {
            // Convert chat history to format expected by backend
            const conversationHistory = baseHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add current message to history
            conversationHistory.push({
                role: newMessage.role,
                content: newMessage.content
            });

            logDev('[LLM] submit', { input: inputText, history: conversationHistory });

            // Append a blank message
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: '',
                references: [],
                timestamp: timestamp,
                thinkingSteps: [],
                thoughtDurationMs: null
            }]);

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            await llmService.chat(inputText, abortControllerRef.current, (update) => {
                logDev('[LLM] update', update);
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
                                    timestamp: timestamp,
                                    thinkingSteps: thinkingStepsRef.current,
                                    thoughtDurationMs: Date.now() - requestStartedAt
                                };
                                newHistory[newHistory.length - 1] = assistantMessage;

                                // Update the LLMAgentService's internal message history
                                llmService.updateMessages(update.answer);

                                return newHistory;
                            });
                            setSelectedMessageIndex(chatHistory.length + 1);
                            break;
                        }
                        {
                            const rawContent = update.content ?? '';
                            if (rawContent.trim()) {
                                const newEntry = { step: update.step, content: rawContent };
                                thinkingStepsRef.current = [...thinkingStepsRef.current, newEntry];
                                const parsedEntry = parseThinkingEntry(newEntry);

                                setStreamingGroups((prev) => {
                                    if (!parsedEntry.line.trim()) {
                                        return prev;
                                    }

                                    const lastGroup = prev[prev.length - 1];
                                    if (!lastGroup || lastGroup.name !== parsedEntry.stepName) {
                                        return [
                                            ...prev,
                                            {
                                                name: parsedEntry.stepName,
                                                lines: parsedEntry.line ? [parsedEntry.line] : []
                                            }
                                        ];
                                    }

                                    if (!parsedEntry.line) {
                                        return prev;
                                    }

                                    const updatedLast = {
                                        ...lastGroup,
                                        lines: [...lastGroup.lines, parsedEntry.line]
                                    };
                                    return [...prev.slice(0, -1), updatedLast];
                                });
                            }
                        }
                        break;
                    case 'final':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                timestamp: timestamp,
                                thinkingSteps: thinkingStepsRef.current,
                                thoughtDurationMs: Date.now() - requestStartedAt
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
                                timestamp: timestamp,
                                thinkingSteps: thinkingStepsRef.current,
                                thoughtDurationMs: Date.now() - requestStartedAt
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
                    timestamp: timestamp,
                    thinkingSteps: thinkingStepsRef.current,
                    thoughtDurationMs: Date.now() - requestStartedAt
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
        startNewConversation();
    };

    const handleMessageClick = (index) => {
        if (chatHistory[index].role === 'assistant') {
            if (isReferencesCollapsed) {
                expandReferences();
            }
            prevSelectedMessageIndexRef.current = null;
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
        startNewConversation();
        handleSubmit(null, query, null, { forceNewConversation: true });
    };

    const handleRegenerateResponse = (e, index) => {
        if (isLoading) return;

        const userMessage = chatHistory[index - 1];
        const newChatHistory = chatHistory.slice(0, index - 1);
        setChatHistory(newChatHistory);

        handleSubmit(e, userMessage.content, userMessage.timestamp);
    };

    const handleReloadLatest = () => {
        if (isLoading) return;
        const lastIndex = chatHistory.length - 1;
        if (lastIndex < 1) return;
        const lastMessage = chatHistory[lastIndex];
        if (!lastMessage || lastMessage.role !== 'assistant') return;
        setShowReloadPrompt(false);
        handleRegenerateResponse(null, lastIndex);
    };

    const MessageCard = ({
        index,
        message,
        refresh,
        copy,
        save,
        goref,
        downloadConversation,
        showReloadPrompt,
        onReloadLatest,
    }) => {
        const isAssistant = message.role === "assistant";
        const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'assistant';
        const isLoading = isProcessing && isLastUserMessage;
        const messageID = index;
        const [editContent, setEditContent] = useState('');
        const [isEditing, setIsEditing] = useState(false);
        const [expandedGroups, setExpandedGroups] = useState({});
        const [thoughtsExpanded, setThoughtsExpanded] = useState(() => isLoading);
        const thoughtDurationLabel = formatDuration(message.thoughtDurationMs);
        const groupedThoughts = useMemo(
            () => groupThinkingSteps(message.thinkingSteps),
            [message.thinkingSteps]
        );
        const activeStreamingGroups = isLoading ? streamingGroups : [];
        const displayGroups = isLoading ? activeStreamingGroups : groupedThoughts;
        const hasDisplayGroups = displayGroups.length > 0;
        const loadingCurrentIndex = isLoading ? displayGroups.length - 1 : -1;
        const thoughtHeaderText = isLoading ? 'Thinking...' : `Thought for ${thoughtDurationLabel}`;
        const showThoughtHeader = isAssistant
            && (isLoading || (!isLoading && thoughtDurationLabel));
        const showReloadInMessage = showReloadPrompt && isLastUserMessage && isAssistant && !isLoading;

        const toggleGroup = useCallback((index) => {
            setExpandedGroups((prev) => ({
                ...prev,
                [index]: !prev[index],
            }));
        }, []);

        useEffect(() => {
            if (isLoading) {
                setThoughtsExpanded(true);
                return;
            }
            setThoughtsExpanded(false);
        }, [isLoading]);

        return (
            <div
                className="message-card"
                data-message-index={index}
                data-message-role={message.role}
            >
                <Container className="message-pair" key={index} sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", mb: "5px", justifyContent: "flex-end" }}>
                    <Box
                        sx={{
                            bgcolor: isAssistant ? "transparent" : "#ffffff", // Different background colors
                            boxShadow: isAssistant ? "none" : "0 4px 16px 0 rgba(0, 0, 0, 0.05)",
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
                        <Box sx={{ flex: 1 }}>
                            {showThoughtHeader && (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    mt: '8px',
                                    mb: '8px',
                                }}>
                                    <Typography sx={{
                                        fontFamily: 'DM Sans, sans-serif',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: '#646464',
                                    }}>
                                        {thoughtHeaderText}
                                    </Typography>
                                    {isLoading && (
                                        <CircularProgress size={14} sx={{ color: '#646464' }} />
                                    )}
                                    {!isLoading && hasDisplayGroups && (
                                        <IconButton
                                            size="small"
                                            onClick={() => setThoughtsExpanded((prev) => !prev)}
                                            aria-label={thoughtsExpanded ? 'Collapse thoughts' : 'Expand thoughts'}
                                            sx={{ padding: '2px' }}
                                        >
                                            <ExpandMoreIcon
                                                sx={{
                                                    fontSize: '16px',
                                                    color: '#646464',
                                                    transform: thoughtsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s ease',
                                                }}
                                            />
                                        </IconButton>
                                    )}
                                </Box>
                            )}

                            {isAssistant && thoughtsExpanded && (isLoading || hasDisplayGroups) && (
                                <Box sx={{
                                    mt: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    borderLeft: '2px solid #E6E6E6',
                                    pl: '12px',
                                }}>
                                    {displayGroups.map((group, groupIndex) => (
                                        <ThoughtGroup
                                            key={`${group.name}-${groupIndex}`}
                                            group={group}
                                            groupIndex={groupIndex}
                                            expanded={isLoading ? groupIndex === loadingCurrentIndex : !!expandedGroups[groupIndex]}
                                            onToggle={toggleGroup}
                                            disableAnimation={isLoading}
                                            disableToggle={isLoading}
                                        />
                                    ))}
                                </Box>
                            )}

                            <Box mt={1}>
                                {showReloadInMessage ? (
                                    <Box
                                        sx={{
                                            backgroundColor: '#F4F4F4',
                                            borderRadius: '8px',
                                            padding: '6px 8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: '#646464',
                                            }}
                                        >
                                            Response interrupted. Reload latest message.
                                        </Typography>
                                        <MuiButton
                                            variant="outlined"
                                            size="small"
                                            onClick={onReloadLatest}
                                            sx={{
                                                textTransform: 'none',
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                minHeight: '28px',
                                                padding: '2px 8px',
                                                borderRadius: '8px',
                                                borderColor: '#D0D0D0',
                                                color: '#646464',
                                                '&:hover': {
                                                    borderColor: '#B8B8B8',
                                                    backgroundColor: '#EDEDED',
                                                },
                                            }}
                                        >
                                            Reload
                                        </MuiButton>
                                    </Box>
                                ) : isLoading ? null :
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
                                        <img
                                            src={replayIcon}
                                            alt="Refresh"
                                            style={{ width: '16px', height: '16px', display: 'block' }}
                                        />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => copy(message.content)}>
                                        <img
                                            src={contentCopyIcon}
                                            alt="Copy"
                                            style={{ width: '16px', height: '16px', display: 'block' }}
                                        />
                                    </IconButton>
                                    {!isLoading && <IconButton size="small" onClick={() => downloadConversation(messageID)} title="Download this Q&A">
                                        <DownloadIcon
                                            aria-label="Download"
                                            style={{ width: '16px', height: '16px', display: 'block', color: '#646464' }}
                                        />
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
                                    <img
                                        src={contentCopyIcon}
                                        alt="Copy"
                                        style={{ width: '16px', height: '16px', display: 'block' }}
                                    />
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
                showReloadPrompt={showReloadPrompt}
                onReloadLatest={handleReloadLatest}
            />
        ))}</Box>);
    };

    const [sortOption, setSortOption] = useState('Year');
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [hoveredPubmedId, setHoveredPubmedId] = useState(null);
    const referencesListRef = useRef(null);
    const isNewChatDisabled = isLoading || chatHistory.length === 0;
    const newChatColor = isNewChatDisabled ? '#B0B0B0' : '#155DFC';

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

            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />

            <div className="llm-page">
                <NavBarWhite />
                <Grid className="llm-grid" container sx={{ width: "100%" }}>
                    <Grid item xs={12} className="llm-subgrid">
                        <div className="llm-main-content">
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
                            <div className='llm-content'>
                                <div className="llm-agent-container">
                                    <div className="chat-and-references">
                                        <Box ref={splitContainerRef} className="llm-split" sx={{ display: 'flex', minHeight: 0, height: '100%' }}>
                                            <Box className="llm-column" sx={{ flex: `0 0 ${leftPaneWidth}%`, minWidth: `${LEFT_MIN_PX}px` }}>
                                                <div className="chat-container">
                                                    <Box className="llm-header" sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '16px',
                                                        height: '70px',
                                                        borderBottom: '1px solid #E6E6E6',
                                                        marginBottom: '1px',
                                                    }}>
                                                        <Typography sx={{
                                                            fontFamily: 'DM Sans, sans-serif',
                                                            fontSize: '16px',
                                                            fontWeight: 600,
                                                            color: '#164563',
                                                            paddingLeft: '16px',
                                                        }}>
                                                            AI Chat
                                                        </Typography>
                                                        <MuiButton onClick={handleClear} disabled={isNewChatDisabled} sx={{
                                                            borderRadius: '16px',
                                                            border: `1px solid ${newChatColor}`,
                                                            backgroundColor: '#ffffff',
                                                            color: newChatColor,
                                                            fontFamily: 'DM Sans, sans-serif',
                                                            fontSize: '14px',
                                                            fontWeight: 700,
                                                            padding: '8px',
                                                            gap: '6px',
                                                            textTransform: 'none',
                                                            opacity: 1,
                                                            '&.Mui-disabled': {
                                                                color: newChatColor,
                                                                border: `1px solid ${newChatColor}`,
                                                                opacity: 1,
                                                            },
                                                            '&:hover': {
                                                                backgroundColor: '#ffffff',
                                                            },
                                                        }}>
                                                            <AddIcon style={{ width: '16px', height: '16px', color: newChatColor }} />
                                                            New Chat
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
                                                    <ChatSearchBar
                                                        userInput={userInput}
                                                        setUserInput={setUserInput}
                                                        isLoading={isLoading}
                                                        onSubmit={handleSubmit}
                                                    />
                                                </div>
                                            </Box>
                                            {!isReferencesCollapsed && (
                                                <>
                                                    <div className="llm-split-divider" onMouseDown={handleSplitMouseDown}>
                                                        {isDraggingSplit && (
                                                            <div
                                                                className="llm-split-drag-indicator"
                                                                style={{ top: `${dragIndicatorY}px` }}
                                                            />
                                                        )}
                                                    </div>
                                                    <Box className="llm-column" sx={{ flex: 1, minWidth: `${RIGHT_MIN_PX}px` }}>
                                                        <div style={{ height: '100%', width: '100%' }}>
                                                            <div className="references-container">
                                                                <div style={{
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    height: '70px',
                                                                    borderBottom: '1px solid #E6E6E6',
                                                                    marginBottom: '1px',
                                                                }}>
                                                                    <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '16px', color: '#164563', marginBottom: '0', paddingLeft: '32px' }}>References</h3>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <ToggleButtonGroup
                                                                            size="small"
                                                                            exclusive
                                                                            value={sortOption}
                                                                            onChange={(event, value) => {
                                                                                if (value !== null) {
                                                                                    setSortOption(value);
                                                                                }
                                                                            }}
                                                                            sx={{
                                                                                border: '1px solid #E7F1FF',
                                                                                borderRadius: '14px',
                                                                                padding: '1px',
                                                                                overflow: 'hidden',
                                                                                '& .MuiToggleButton-root': {
                                                                                    textTransform: 'none',
                                                                                    fontFamily: 'DM Sans, sans-serif',
                                                                                    fontSize: '12px',
                                                                                    fontWeight: 700,
                                                                                    color: '#164563',
                                                                                    border: 'none',
                                                                                    padding: '0 8px',
                                                                                    height: '26px',
                                                                                    minHeight: '26px',
                                                                                    borderRadius: '13px',
                                                                                },
                                                                                '& .MuiToggleButton-root.Mui-selected': {
                                                                                    backgroundColor: '#E7F1FF',
                                                                                    color: '#164563',
                                                                                },
                                                                                '& .MuiToggleButton-root.Mui-selected:hover': {
                                                                                    backgroundColor: '#E0EDFF',
                                                                                },
                                                                            }}
                                                                        >
                                                                            <ToggleButton value="Citations">Citation</ToggleButton>
                                                                            <ToggleButton value="Year">Year</ToggleButton>
                                                                        </ToggleButtonGroup>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={collapseReferences}
                                                                            sx={{
                                                                                padding: '6px',
                                                                                '&:hover': {
                                                                                    backgroundColor: '#f0f0f0',
                                                                                }
                                                                            }}
                                                                            title="Collapse references"
                                                                        >
                                                                            <ChevronRightIcon sx={{ color: '#164563' }} />
                                                                        </IconButton>
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
                                                                            <DownloadIcon
                                                                                aria-label="Download references"
                                                                                style={{
                                                                                    width: '20px',
                                                                                    height: '20px',
                                                                                    display: 'block',
                                                                                    color: '#164563',
                                                                                }}
                                                                            />
                                                                        </IconButton>
                                                                    </div>
                                                                </div>

                                                                {sortedReferences.length > 0 ? (
                                                                    <div ref={referencesListRef} className="references-list" style={{ maxHeight: 'calc(100% - 70px)', overflowY: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
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
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <p style={{ padding: '16px 32px' }}>No references available for this response.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Box>
                                                </>
                                            )}
                                        </Box>
                                        {isReferencesCollapsed && (
                                            <IconButton
                                                className="references-collapse-button"
                                                onClick={expandReferences}
                                                aria-label="Open references"
                                            >
                                                <ChevronLeftIcon />
                                            </IconButton>
                                        )}


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