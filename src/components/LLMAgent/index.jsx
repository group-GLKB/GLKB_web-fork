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
import remarkGfm from 'remark-gfm';

import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Check as CheckIcon,
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
import {
  ReactComponent as SidebarLeftIcon,
} from '../../img/navbar/sidebar.left.svg';
import { LLMAgentService } from '../../service/LLMAgent';
import {
  createConversation,
  fetchConversationDetail,
  fetchConversations,
  getActiveConversationId,
  getConversations,
  setActiveConversationId,
  setConversations,
  updateConversationMessages,
  upsertConversation,
} from '../../utils/chatHistory';
import {
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../utils/conversationBookmarks';
import CiteDialog from '../Units/CiteDialog';
import ReferenceCard from '../Units/ReferenceCard/ReferenceCard';
import ChatSearchBar from './ChatSearchBar';
import stepLabels from './step.json';

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

const SESSION_ID_KEY = 'llmSessionIds';

const getSessionIdMap = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
};

const getStoredSessionId = (historyId) => {
    if (!historyId || typeof window === 'undefined') return null;
    const map = getSessionIdMap();
    return map[String(historyId)] || null;
};

const setStoredSessionId = (historyId, sessionId) => {
    if (!historyId || typeof window === 'undefined') return;
    const map = getSessionIdMap();
    if (sessionId) {
        map[String(historyId)] = sessionId;
    } else {
        delete map[String(historyId)];
    }
    sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify(map));
};

const STEP_LABELS = stepLabels || {};

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
            trajectory: leftMsg?.trajectory,
        });
        const rightSignature = JSON.stringify({
            role: rightMsg?.role,
            content: rightMsg?.content,
            timestamp: rightMsg?.timestamp,
            references: rightMsg?.references,
            thinkingSteps: rightMsg?.thinkingSteps,
            thoughtDurationMs: rightMsg?.thoughtDurationMs,
            trajectory: rightMsg?.trajectory,
        });
        if (leftSignature !== rightSignature) return false;
    }

    return true;
};

const getStepLabel = (stepName) => STEP_LABELS[stepName] || stepName;

const ThoughtLine = React.memo(function ThoughtLine({ line, lineKey }) {
    const isTrajectoryLine = line && typeof line === 'object' && !Array.isArray(line);

    if (isTrajectoryLine) {
        const tool = line.tool || '';
        const summary = line.summary || '';
        const result = line.result || '';
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                }}
                data-line-key={lineKey}
            >
                {(tool || summary) && (
                    <Typography
                        sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 400,
                            color: '#5B5B5B',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                        }}
                    >
                        {tool && (
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '16px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    color: '#7A7A7A',
                                    marginRight: '6px',
                                }}
                            >
                                {tool}
                            </Box>
                        )}
                        {summary}
                    </Typography>
                )}
                {result && (
                    <Typography
                        sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 400,
                            color: '#5B5B5B',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                        }}
                    >
                        {result}
                    </Typography>
                )}
            </Box>
        );
    }

    return (
        <Typography
            sx={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 400,
                color: '#969696',
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
        showBorder = true,
    }) {
        const hasLines = group.lines.length > 0;
        const canToggle = hasLines && !disableToggle;
        return (
            <Box>
                <Box
                    role={canToggle ? 'button' : undefined}
                    tabIndex={canToggle ? 0 : -1}
                    onClick={canToggle ? () => onToggle(groupIndex) : undefined}
                    onKeyDown={(event) => {
                        if (!canToggle) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onToggle(groupIndex);
                        }
                    }}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: canToggle ? 'pointer' : 'default',
                        '&:hover': canToggle ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' } : undefined,
                        '&:hover .thought-step-arrow': canToggle ? { opacity: 1 } : undefined,
                    }}
                >
                    <Typography sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 400,
                        color: '#5B5B5B',
                    }}>
                        {getStepLabel(group.name)}
                    </Typography>
                    {canToggle && (
                        <ExpandMoreIcon
                            className="thought-step-arrow"
                            sx={{
                                fontSize: '18px',
                                color: '#8A8A8A',
                                opacity: 0,
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                        />
                    )}
                </Box>
                {expanded && hasLines && (
                    <Box sx={{
                        mt: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        borderLeft: showBorder ? '2px solid #D9D9D9' : 'none',
                        pl: showBorder ? '10px' : '0px',
                        ml: showBorder ? 2 : '0px',
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

const normalizeTrajectory = (trajectory) => {
    if (!trajectory) return [];
    if (Array.isArray(trajectory)) return trajectory;
    if (typeof trajectory === 'string') {
        try {
            const parsed = JSON.parse(trajectory);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
};

const trajectoryToGroups = (trajectory) => {
    const normalized = normalizeTrajectory(trajectory);
    if (!normalized.length) return [];

    return normalized
        .map((entry, index) => {
            const phase = typeof entry?.phase === 'string' ? entry.phase.trim() : '';
            const name = phase || `Phase ${index + 1}`;
            const actions = Array.isArray(entry?.actions) ? entry.actions : [];
            const lines = [];

            actions.forEach((action) => {
                if (!action) return;
                const tool = typeof action.tool === 'string' ? action.tool.trim() : '';
                const summary = typeof action.summary === 'string' ? action.summary.trim() : '';
                const result = typeof action.result === 'string' ? action.result.trim() : '';

                if (tool || summary) {
                    lines.push({
                        tool,
                        summary: summary || 'Action',
                        result: result ? `Result: ${result}` : '',
                    });
                }
            });

            return { name, lines };
        })
        .filter((group) => group.name || group.lines.length > 0);
};

const MessageCard = React.memo(function MessageCard({
    index,
    message,
    totalMessages,
    isProcessing,
    streamingGroups,
    streamingStepName,
    selectedMessageIndex,
    showReloadPrompt,
    onReloadLatest,
    onStop,
    refresh,
    copy,
    save,
    goref,
    downloadConversation,
}) {
    const isAssistant = message.role === "assistant";
    const isLastUserMessage = index === totalMessages - 1 && message.role === 'assistant';
    const isLoading = isProcessing && isLastUserMessage;
    const messageID = index;
    const [editContent, setEditContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [thoughtsExpanded, setThoughtsExpanded] = useState(() => isLoading);
    const [animatedStepLabel, setAnimatedStepLabel] = useState('');
    const [stepLabelPhase, setStepLabelPhase] = useState('idle');
    const stepLabelTimersRef = useRef([]);
    const renderedStepLabelRef = useRef('');
    const thoughtDurationLabel = formatDuration(message.thoughtDurationMs);
    const groupedThoughts = useMemo(
        () => groupThinkingSteps(message.thinkingSteps),
        [message.thinkingSteps]
    );
    const trajectoryGroups = useMemo(
        () => trajectoryToGroups(message.trajectory),
        [message.trajectory]
    );
    const activeStreamingGroups = isLoading ? streamingGroups : [];
    const staticGroups = !isLoading && trajectoryGroups.length
        ? trajectoryGroups
        : groupedThoughts;
    const displayGroups = isLoading ? activeStreamingGroups : staticGroups;
    const hasDisplayGroups = displayGroups.length > 0;
    const isTrajectoryDisplay = !isLoading && trajectoryGroups.length > 0;
    const loadingCurrentIndex = isLoading ? displayGroups.length - 1 : -1;
    const currentStepLabel = useMemo(() => {
        if (!isLoading) return '';
        if (streamingStepName) return getStepLabel(streamingStepName);
        if (!activeStreamingGroups.length) return 'Thinking';
        return getStepLabel(activeStreamingGroups[activeStreamingGroups.length - 1].name);
    }, [isLoading, streamingStepName, activeStreamingGroups]);
    const loadingStepLabel = useMemo(() => {
        if (!isLoading) return '';
        if (!currentStepLabel) return 'Thinking...';
        return currentStepLabel.endsWith('...') ? currentStepLabel : `${currentStepLabel}...`;
    }, [isLoading, currentStepLabel]);
    const thoughtHeaderText = isLoading
        ? (animatedStepLabel || loadingStepLabel)
        : (thoughtDurationLabel ? `Thought for ${thoughtDurationLabel}` : 'Thought summary');
    const showThoughtHeader = isAssistant
        && (isLoading || thoughtDurationLabel || hasDisplayGroups);
    const showReloadInMessage = showReloadPrompt && isLastUserMessage && isAssistant && !isLoading;
    const canToggleThoughts = !isLoading && hasDisplayGroups;

    const toggleGroup = useCallback((nextIndex) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [nextIndex]: !prev[nextIndex],
        }));
    }, []);

    useEffect(() => {
        if (isLoading) {
            setThoughtsExpanded(true);
            return;
        }
        setThoughtsExpanded(false);
    }, [isLoading]);

    useEffect(() => {
        const clearTimers = () => {
            stepLabelTimersRef.current.forEach((timerId) => clearTimeout(timerId));
            stepLabelTimersRef.current = [];
        };

        clearTimers();

        if (!isLoading || !loadingStepLabel) {
            renderedStepLabelRef.current = '';
            setAnimatedStepLabel('');
            setStepLabelPhase('idle');
            return undefined;
        }

        const currentLabel = renderedStepLabelRef.current;
        if (!currentLabel) {
            renderedStepLabelRef.current = loadingStepLabel;
            setAnimatedStepLabel(loadingStepLabel);
            setStepLabelPhase('idle');
            return undefined;
        }

        if (currentLabel === loadingStepLabel) {
            return undefined;
        }

        const OUT_MS = 140;
        const BUFFER_MS = 80;
        const IN_MS = 180;

        setStepLabelPhase('out');
        const outTimer = setTimeout(() => {
            renderedStepLabelRef.current = loadingStepLabel;
            setAnimatedStepLabel(loadingStepLabel);
            setStepLabelPhase('in');
            const inTimer = setTimeout(() => {
                setStepLabelPhase('idle');
            }, IN_MS);
            stepLabelTimersRef.current.push(inTimer);
        }, OUT_MS + BUFFER_MS);
        stepLabelTimersRef.current.push(outTimer);

        return clearTimers;
    }, [isLoading, loadingStepLabel]);

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
                        width: isAssistant ? "100%" : "auto",
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
                                mt: '8px',
                                mb: '8px',
                            }}>
                                <Box
                                    role={canToggleThoughts ? 'button' : undefined}
                                    tabIndex={canToggleThoughts ? 0 : -1}
                                    onClick={canToggleThoughts ? () => setThoughtsExpanded((prev) => !prev) : undefined}
                                    onKeyDown={(event) => {
                                        if (!canToggleThoughts) return;
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setThoughtsExpanded((prev) => !prev);
                                        }
                                    }}
                                    aria-label={
                                        canToggleThoughts
                                            ? (thoughtsExpanded ? 'Collapse thoughts' : 'Expand thoughts')
                                            : undefined
                                    }
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        borderRadius: '18px',
                                        cursor: canToggleThoughts ? 'pointer' : 'default',
                                        '&:hover': canToggleThoughts ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' } : undefined,
                                    }}
                                >
                                    <Box
                                        component="span"
                                        className={isLoading
                                            ? `loading-step-label${stepLabelPhase !== 'idle' ? ` loading-step-label--${stepLabelPhase}` : ''}`
                                            : undefined}
                                        sx={{
                                            fontFamily: 'DM Sans, sans-serif',
                                            fontSize: '16px',
                                            fontWeight: isLoading ? 400 : 600,
                                            color: isLoading ? 'transparent' : '#5B5B5B',
                                            WebkitTextFillColor: isLoading ? 'transparent' : undefined,
                                        }}
                                    >
                                        {thoughtHeaderText}
                                    </Box>
                                    {canToggleThoughts && (
                                        <ExpandMoreIcon
                                            sx={{
                                                fontSize: '16px',
                                                color: '#646464',
                                                transform: thoughtsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        )}

                        {isAssistant && !isLoading && thoughtsExpanded && hasDisplayGroups && (
                            <Box sx={{
                                mt: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0px',
                                borderLeft: '2px solid #E6E6E6',
                                pl: '4px',
                                ml: 1,
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
                                        onChange={(event) => setEditContent(event.target.value)}
                                    /> : (
                                        <div className="markdown-body" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                        </Box>

                        {isAssistant && <Box sx={{ justifyContent: "space-between", direction: "row", display: "flex", alignItems: "center", mt: "5px" }}>
                            <Stack direction="row" spacing={1} mt={2} sx={{ pb: "8px" }}>
                                <IconButton size="small" onClick={(event) => refresh(event, messageID)}>
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
                                {isLoading && (
                                    <IconButton size="small" onClick={onStop}>
                                        <StopCircleIcon fontSize="small" />
                                    </IconButton>
                                )}
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
                            <IconButton size="small" onClick={(event) => {
                                if (editContent.trim() === '') {
                                    return;
                                }
                                save(event, messageID, editContent);
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
});

function LLMAgent() {
    const location = useLocation();
    const [userInput, setUserInput] = useState('');
    const [chatHistory, setChatHistory] = useState(getStoredChatHistory);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingGroups, setStreamingGroups] = useState([]);
    const [streamingStepName, setStreamingStepName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [leftPaneWidth, setLeftPaneWidth] = useState(66);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);
    const [dragIndicatorY, setDragIndicatorY] = useState(0);
    const [isReferencesCollapsed, setIsReferencesCollapsed] = useState(false);
    const [conversationsState, setConversationsState] = useState(() => getConversations());
    const [activeConversationId, setActiveConversationIdState] = useState(() => getActiveConversationId());
    const [isConversationLoading, setIsConversationLoading] = useState(false);
    const [loadingConversationId, setLoadingConversationId] = useState(null);
    const [conversationBookmarks, setConversationBookmarksState] = useState(() => getConversationBookmarks());
    const [showReloadPrompt, setShowReloadPrompt] = useState(
        () => getStoredProcessingFlag() || getStoredIncompleteFlag()
    );
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const thinkingStepsRef = useRef([]);
    const prevSelectedMessageIndexRef = useRef(null);
    const lastAutoSelectedRef = useRef(null);
    const sessionIdRef = useRef(null);
    const hasConsumedInitialQueryRef = useRef(false);
    const activeConversationIdRef = useRef(getActiveConversationId());
    const loadingConversationIdRef = useRef(null);
    const activeStreamIdRef = useRef(null);
    const splitContainerRef = useRef(null);
    const isDraggingSplitRef = useRef(false);
    const navigate = useNavigate();

    const llmService = useMemo(() => new LLMAgentService(), []);
    const activeConversation = useMemo(() => {
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return null;
        return conversationsState.find((item) => String(item.id) === String(currentId)) || null;
    }, [activeConversationId, conversationsState]);
    const chatTitle = useMemo(() => {
        if (activeConversation?.leadingTitle) return activeConversation.leadingTitle;
        const firstUser = chatHistory.find((msg) => msg.role === 'user');
        if (firstUser?.content) return firstUser.content;
        return 'New Chat';
    }, [activeConversation, chatHistory]);
    const isConversationBookmarked = useMemo(() => {
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return false;
        return conversationBookmarks.some((item) => String(item.id) === String(currentId));
    }, [activeConversationId, conversationBookmarks]);

    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    useEffect(() => {
        const update = (event) => {
            const next = event?.detail || getConversationBookmarks();
            setConversationBookmarksState(next);
        };
        update();
        window.addEventListener('glkb-conversation-bookmarks-updated', update);
        return () => window.removeEventListener('glkb-conversation-bookmarks-updated', update);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initializeConversations = async () => {
            const cached = getConversations();
            let nextActiveId = getActiveConversationId();
            const hasInitialQuery = Boolean(location.state?.initialQuery);
            const hasConversationId = Boolean(location.state?.conversationId);
            const shouldSkipRestore = hasInitialQuery || hasConversationId;

            if (cached.length > 0) {
                setConversationsState(cached);
            }

            try {
                const list = await fetchConversations();
                if (!isMounted) return;
                setConversationsState(list);

                if (!shouldSkipRestore && !nextActiveId && list.length > 0) {
                    nextActiveId = list[0].id;
                    setActiveConversationId(nextActiveId);
                }
            } catch (error) {
                logDev('[LLM] Failed to load conversations', error);
            }

            if (shouldSkipRestore) {
                return;
            }

            if (nextActiveId) {
                const targetId = String(nextActiveId);
                loadingConversationIdRef.current = targetId;
                setLoadingConversationId(targetId);
                setIsConversationLoading(true);
                try {
                    const detail = await fetchConversationDetail(nextActiveId);
                    if (!isMounted) return;
                    sessionIdRef.current = getStoredSessionId(nextActiveId);
                    setChatHistory(detail?.messages || []);
                    setActiveConversationIdState(String(nextActiveId));
                    activeConversationIdRef.current = String(nextActiveId);
                } catch (error) {
                    logDev('[LLM] Failed to load conversation detail', error);
                } finally {
                    if (isMounted && loadingConversationIdRef.current === targetId) {
                        setIsConversationLoading(false);
                        setLoadingConversationId(null);
                    }
                }
            } else {
                setActiveConversationIdState(null);
                activeConversationIdRef.current = null;
                setIsConversationLoading(false);
                setLoadingConversationId(null);
            }
        };

        initializeConversations();
        return () => {
            isMounted = false;
        };
    }, []);

    const cancelStreaming = useCallback((options = {}) => {
        const { abort = true } = options;
        if (abort && abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = null;
        activeStreamIdRef.current = null;
        setIsLoading(false);
        setIsProcessing(false);
        setStreamingGroups([]);
        setStreamingStepName('');
        thinkingStepsRef.current = [];
    }, []);

    useEffect(() => {
        const conversationId = location.state?.conversationId;
        if (!conversationId) return;
        let isMounted = true;

        const loadConversation = async () => {
            cancelStreaming({ abort: false });
            const targetId = String(conversationId);
            loadingConversationIdRef.current = targetId;
            setLoadingConversationId(targetId);
            setIsConversationLoading(true);
            try {
                const detail = await fetchConversationDetail(conversationId);
                if (!isMounted) return;
                const nextId = String(detail?.id || conversationId);
                setConversationsState(getConversations());
                setActiveConversationId(nextId);
                setActiveConversationIdState(nextId);
                activeConversationIdRef.current = nextId;
                sessionIdRef.current = getStoredSessionId(nextId);
                lastAutoSelectedRef.current = null;
                setHoveredPubmedId(null);
                setChatHistory(detail?.messages || []);
                setSelectedMessageIndex(null);
                setShowReloadPrompt(false);
                llmService.clearHistory();
            } catch (error) {
                logDev('[LLM] Failed to load selected conversation', error);
            } finally {
                if (isMounted && loadingConversationIdRef.current === targetId) {
                    setIsConversationLoading(false);
                    setLoadingConversationId(null);
                }
            }
        };

        loadConversation();
        return () => {
            isMounted = false;
        };
    }, [location.state, cancelStreaming, llmService]);

    const startNewConversation = useCallback(() => {
        cancelStreaming();
        setChatHistory([]);
        setSelectedMessageIndex(null);
        lastAutoSelectedRef.current = null;
        setHoveredPubmedId(null);
        sessionIdRef.current = null;
        setStreamingStepName('');
        setShowReloadPrompt(false);
        setIsConversationLoading(false);
        setLoadingConversationId(null);
        loadingConversationIdRef.current = null;
        setActiveConversationIdState(null);
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        llmService.clearHistory();
    }, [cancelStreaming, llmService]);

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

        const handleReferenceClick = (e) => {
            const link = e.target.closest('a[href*="pubmed.ncbi.nlm.nih.gov"]');
            if (!link || !link.href) return;
            e.preventDefault();
            const pubmedId = link.href.split('/').filter(Boolean).pop();
            if (!pubmedId) return;
            const messageCard = link.closest('.message-card');
            const messageIndex = messageCard ? Number(messageCard.dataset.messageIndex) : null;
            const messageRole = messageCard?.dataset?.messageRole;
            if (Number.isFinite(messageIndex) && messageRole === 'assistant') {
                handleMessageClick(messageIndex);
            } else if (isReferencesCollapsed) {
                expandReferences();
            }
            setHoveredPubmedId(pubmedId);
        };

        const handleMouseLeave = () => {
            setHoveredPubmedId(null);
        };

        container.addEventListener('mouseover', handleMouseOver);
        container.addEventListener('mouseout', handleMouseOut);
        container.addEventListener('click', handleReferenceClick);
        container.addEventListener('mouseleave', handleMouseLeave);

        const links = container.querySelectorAll('a');
        links.forEach(link => {
            if (link.href && link.href.includes('pubmed.ncbi.nlm.nih.gov')) {
                link.removeAttribute('target');
                link.removeAttribute('rel');
                return;
            }
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        return () => {
            container.removeEventListener('mouseover', handleMouseOver);
            container.removeEventListener('mouseout', handleMouseOut);
            container.removeEventListener('click', handleReferenceClick);
            container.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [chatHistory, expandReferences, isReferencesCollapsed]);

    const parseReferences = (refs) => {
        if (!refs || !Array.isArray(refs)) return [];

        return refs.map((ref) => {
            if (Array.isArray(ref)) {
                const [title, pubmedUrl, citationCount, year, journal, authors] = ref;
                return {
                    title,
                    url: pubmedUrl,
                    citation_count: citationCount,
                    year,
                    journal,
                    authors: Array.isArray(authors) ? authors.join(', ') : 'Authors not available',
                    evidence: [],
                };
            }
            const title = ref?.title || '';
            const url = ref?.url || '';
            const citationCount = ref?.n_citation ?? ref?.citation_count ?? 0;
            const year = ref?.date ?? ref?.year ?? '';
            const journal = ref?.journal || '';
            const authors = Array.isArray(ref?.authors) ? ref.authors.join(', ') : 'Authors not available';
            const evidence = Array.isArray(ref?.evidence) ? ref.evidence : [];
            return {
                title,
                url,
                citation_count: citationCount,
                year,
                journal,
                authors,
                evidence,
            };
        });
    };

    const handleSubmit = async (e, input = null, t = null, options = {}) => {
        const inputText = input || userInput;
        e && e.preventDefault();
        if (!inputText.trim() || isLoading) return;

        const shouldStartNewConversation = options.forceNewConversation || !activeConversationIdRef.current;
        const baseHistory = shouldStartNewConversation ? [] : chatHistory;
        const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeStreamIdRef.current = streamId;

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

        let historyId = activeConversationIdRef.current;
        if (shouldStartNewConversation) {
            try {
                const leadingTitle = inputText.trim().slice(0, 200) || null;
                const conversation = await createConversation(leadingTitle);
                const nextList = upsertConversation(getConversations(), conversation);
                setConversationsState(nextList);
                setConversations(nextList);
                historyId = conversation?.id || null;
                setActiveConversationIdState(historyId);
                activeConversationIdRef.current = historyId;
                if (historyId) {
                    setActiveConversationId(historyId);
                }
            } catch (error) {
                logDev('[LLM] Failed to create conversation', error);
            }
        }
        sessionIdRef.current = getStoredSessionId(historyId) || sessionIdRef.current;

        // Update chat history with user message
        setChatHistory([...baseHistory, newMessage]);
        setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingGroups([]);
        setStreamingStepName('');
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
                thoughtDurationMs: null,
                trajectory: null,
            }]);

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            await llmService.chat(inputText, abortControllerRef.current, (update) => {
                const isActiveStream = activeStreamIdRef.current === streamId;
                if (!isActiveStream && update.type !== 'saved') {
                    return;
                }
                logDev('[LLM] update', update);
                switch (update.type) {
                    case 'step':
                        if (!isActiveStream) return;
                        {
                            const rawContent = update.content ?? '';
                            const hasContent = Boolean(rawContent.trim());
                            if (update.step && hasContent) {
                                setStreamingStepName(update.step);
                            }
                            if (update.step === 'Error') {
                                setIsProcessing(false);
                                setStreamingStepName('');
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
                            if (hasContent) {
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
                        if (!isActiveStream) return;
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        setIsProcessing(false);
                        setStreamingStepName('');
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                timestamp: timestamp,
                                thinkingSteps: thinkingStepsRef.current,
                                thoughtDurationMs: Date.now() - requestStartedAt,
                                trajectory: update.trajectory || null,
                            };
                            newHistory[newHistory.length - 1] = assistantMessage;

                            // Update the LLMAgentService's internal message history
                            llmService.updateMessages(update.answer);

                            return newHistory;
                        });
                        setSelectedMessageIndex(chatHistory.length + 1);
                        break;
                    case 'saved': {
                        if (isActiveStream) {
                            const savedId = update.historyId ? String(update.historyId) : null;
                            if (savedId && savedId !== activeConversationIdRef.current) {
                                setActiveConversationId(savedId);
                                setActiveConversationIdState(savedId);
                                activeConversationIdRef.current = savedId;
                            }
                            if (savedId) {
                                const nextSessionId = update.sessionId || sessionIdRef.current;
                                if (nextSessionId) {
                                    sessionIdRef.current = nextSessionId;
                                    setStoredSessionId(savedId, nextSessionId);
                                }
                            }
                        }
                        fetchConversations()
                            .then((list) => setConversationsState(list))
                            .catch((error) => logDev('[LLM] Failed to refresh conversations', error));
                        break;
                    }
                    case 'error': // unsure if this is used
                        if (!isActiveStream) return;
                        setIsProcessing(false);
                        setStreamingStepName('');
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
            }, {
                messagesOverride: conversationHistory,
                historyId,
                sessionId: sessionIdRef.current
            });
        } catch (error) {
            console.error('Error in chat:', error);
            if (activeStreamIdRef.current === streamId) {
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
            }
        } finally {
            if (activeStreamIdRef.current === streamId) {
                setIsLoading(false);
                setIsProcessing(false);
                activeStreamIdRef.current = null;
            }
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

    const handleToggleConversationBookmark = () => {
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return;
        const entry = {
            id: String(currentId),
            title: chatTitle,
            updatedAt: activeConversation?.updatedAt || new Date().toISOString(),
            messageCount: activeConversation?.messageCount ?? chatHistory.length,
        };
        const next = toggleConversationBookmark(entry);
        setConversationBookmarksState(next);
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

    useEffect(() => {
        if (!chatHistory.length) {
            lastAutoSelectedRef.current = null;
            setSelectedMessageIndex(null);
            return;
        }
        if (isProcessing) return;

        let lastAssistantIndex = -1;
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
            if (chatHistory[i]?.role === 'assistant') {
                lastAssistantIndex = i;
                break;
            }
        }
        if (lastAssistantIndex < 0) return;
        if (lastAutoSelectedRef.current === lastAssistantIndex) return;

        lastAutoSelectedRef.current = lastAssistantIndex;
        setSelectedMessageIndex(lastAssistantIndex);
    }, [chatHistory, isProcessing]);

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

    const handleStopStreaming = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
    }, []);

    const MessageCardInner = ({
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
        const [animatedStepLabel, setAnimatedStepLabel] = useState('');
        const [stepLabelPhase, setStepLabelPhase] = useState('idle');
        const stepLabelTimersRef = useRef([]);
        const renderedStepLabelRef = useRef('');
        const thoughtDurationLabel = formatDuration(message.thoughtDurationMs);
        const groupedThoughts = useMemo(
            () => groupThinkingSteps(message.thinkingSteps),
            [message.thinkingSteps]
        );
        const trajectoryGroups = useMemo(
            () => trajectoryToGroups(message.trajectory),
            [message.trajectory]
        );
        const activeStreamingGroups = isLoading ? streamingGroups : [];
        const staticGroups = !isLoading && trajectoryGroups.length
            ? trajectoryGroups
            : groupedThoughts;
        const displayGroups = isLoading ? activeStreamingGroups : staticGroups;
        const hasDisplayGroups = displayGroups.length > 0;
        const isTrajectoryDisplay = !isLoading && trajectoryGroups.length > 0;
        const loadingCurrentIndex = isLoading ? displayGroups.length - 1 : -1;
        const currentStepLabel = useMemo(() => {
            if (!isLoading) return '';
            if (!activeStreamingGroups.length) return 'Thinking';
            return getStepLabel(activeStreamingGroups[activeStreamingGroups.length - 1].name);
        }, [isLoading, activeStreamingGroups]);
        const loadingStepLabel = useMemo(() => {
            if (!isLoading) return '';
            if (!currentStepLabel) return 'Thinking...';
            return currentStepLabel.endsWith('...') ? currentStepLabel : `${currentStepLabel}...`;
        }, [isLoading, currentStepLabel]);
        const thoughtHeaderText = isLoading
            ? (animatedStepLabel || loadingStepLabel)
            : (thoughtDurationLabel ? `Thought for ${thoughtDurationLabel}` : 'Thought summary');
        const showThoughtHeader = isAssistant
            && (isLoading || thoughtDurationLabel || hasDisplayGroups);
        const showReloadInMessage = showReloadPrompt && isLastUserMessage && isAssistant && !isLoading;
        const canToggleThoughts = !isLoading && hasDisplayGroups;

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

        useEffect(() => {
            const clearTimers = () => {
                stepLabelTimersRef.current.forEach((timerId) => clearTimeout(timerId));
                stepLabelTimersRef.current = [];
            };

            clearTimers();

            if (!isLoading || !loadingStepLabel) {
                renderedStepLabelRef.current = '';
                setAnimatedStepLabel('');
                setStepLabelPhase('idle');
                return undefined;
            }

            const currentLabel = renderedStepLabelRef.current;
            if (!currentLabel) {
                renderedStepLabelRef.current = loadingStepLabel;
                setAnimatedStepLabel(loadingStepLabel);
                setStepLabelPhase('idle');
                return undefined;
            }

            if (currentLabel === loadingStepLabel) {
                return undefined;
            }

            const OUT_MS = 140;
            const BUFFER_MS = 80;
            const IN_MS = 180;

            setStepLabelPhase('out');
            const outTimer = setTimeout(() => {
                renderedStepLabelRef.current = loadingStepLabel;
                setAnimatedStepLabel(loadingStepLabel);
                setStepLabelPhase('in');
                const inTimer = setTimeout(() => {
                    setStepLabelPhase('idle');
                }, IN_MS);
                stepLabelTimersRef.current.push(inTimer);
            }, OUT_MS + BUFFER_MS);
            stepLabelTimersRef.current.push(outTimer);

            return clearTimers;
        }, [isLoading, loadingStepLabel]);

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
                            width: isAssistant ? "100%" : "auto",
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
                                    mt: '8px',
                                    mb: '8px',
                                }}>
                                    <Box
                                        role={canToggleThoughts ? 'button' : undefined}
                                        tabIndex={canToggleThoughts ? 0 : -1}
                                        onClick={canToggleThoughts ? () => setThoughtsExpanded((prev) => !prev) : undefined}
                                        onKeyDown={(event) => {
                                            if (!canToggleThoughts) return;
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                setThoughtsExpanded((prev) => !prev);
                                            }
                                        }}
                                        aria-label={
                                            canToggleThoughts
                                                ? (thoughtsExpanded ? 'Collapse thoughts' : 'Expand thoughts')
                                                : undefined
                                        }
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 8px',
                                            borderRadius: '18px',
                                            cursor: canToggleThoughts ? 'pointer' : 'default',
                                            '&:hover': canToggleThoughts ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' } : undefined,
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            className={isLoading
                                                ? `loading-step-label${stepLabelPhase !== 'idle' ? ` loading-step-label--${stepLabelPhase}` : ''}`
                                                : undefined}
                                            sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontSize: '16px',
                                                fontWeight: isLoading ? 400 : 600,
                                                color: isLoading ? 'transparent' : '#5B5B5B',
                                                WebkitTextFillColor: isLoading ? 'transparent' : undefined,
                                            }}
                                        >
                                            {thoughtHeaderText}
                                        </Box>
                                        {canToggleThoughts && (
                                            <ExpandMoreIcon
                                                sx={{
                                                    fontSize: '16px',
                                                    color: '#646464',
                                                    transform: thoughtsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s ease',
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            )}

                            {isAssistant && !isLoading && thoughtsExpanded && hasDisplayGroups && (
                                <Box sx={{
                                    mt: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0px',
                                    borderLeft: isTrajectoryDisplay ? 'none' : '2px solid #E6E6E6',
                                    pl: isTrajectoryDisplay ? '0px' : '12px',
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
                                            showBorder={!isTrajectoryDisplay}
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
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                totalMessages={chatHistory.length}
                isProcessing={isProcessing}
                streamingGroups={streamingGroups}
                streamingStepName={streamingStepName}
                selectedMessageIndex={selectedMessageIndex}
                refresh={handleRegenerateResponse}
                copy={handleCopyMessage}
                save={handleSaveEdit}
                goref={handleMessageClick}
                downloadConversation={handleDownloadConversation}
                showReloadPrompt={showReloadPrompt}
                onReloadLatest={handleReloadLatest}
                onStop={handleStopStreaming}
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

    useEffect(() => {
        if (!hoveredPubmedId) return;
        const isStillVisible = references.some((ref) => {
            const pubmedId = ref.url?.split('/')?.filter(Boolean)?.pop();
            return pubmedId === hoveredPubmedId;
        });
        if (!isStillVisible) {
            setHoveredPubmedId(null);
        }
    }, [hoveredPubmedId, references]);

    const sortedReferences = useMemo(() => {
        const sorted = [...references];
        if (sortOption === 'Citations') {
            sorted.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
        } else {
            sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
        }
        return sorted;
    }, [references, sortOption]);
    const isExportDisabled = sortedReferences.length === 0;

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
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            paddingLeft: '16px',
                                                            minWidth: 0,
                                                            flex: 1,
                                                        }}>
                                                            <Typography sx={{
                                                                fontFamily: 'DM Sans, sans-serif',
                                                                fontSize: '16px',
                                                                fontWeight: 500,
                                                                color: '#164563',
                                                                textDecoration: 'underline',
                                                            }}>
                                                                AI Chat
                                                            </Typography>
                                                            <Typography sx={{
                                                                fontFamily: 'DM Sans, sans-serif',
                                                                fontSize: '16px',
                                                                fontWeight: 500,
                                                                color: '#8A8A8A',
                                                            }}>
                                                                &gt;
                                                            </Typography>
                                                            <Typography sx={{
                                                                fontFamily: 'DM Sans, sans-serif',
                                                                fontSize: '16px',
                                                                fontWeight: 600,
                                                                color: '#164563',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                maxWidth: '280px',
                                                            }}>
                                                                {chatTitle}
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                onClick={handleToggleConversationBookmark}
                                                                disabled={!activeConversationIdRef.current && !activeConversationId}
                                                                sx={{
                                                                    padding: '4px',
                                                                    color: isConversationBookmarked ? '#2c5cf3' : '#8A8A8A',
                                                                    '&:hover': {
                                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                                    },
                                                                }}
                                                                title={isConversationBookmarked ? 'Remove bookmark' : 'Bookmark this chat'}
                                                            >
                                                                {isConversationBookmarked ? (
                                                                    <BookmarkIcon sx={{ fontSize: 18 }} />
                                                                ) : (
                                                                    <BookmarkBorderIcon sx={{ fontSize: 18 }} />
                                                                )}
                                                            </IconButton>
                                                        </Box>
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
                                                    {!isConversationLoading && chatHistory.length === 0 && (
                                                        <div className='empty-components-container'>
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
                                                        {!isConversationLoading && renderMessages()}
                                                        <div ref={messagesEndRef} />
                                                    </div>
                                                    {isConversationLoading && loadingConversationId && (
                                                        <div className="chat-loading-overlay">
                                                            <CircularProgress size={28} sx={{ color: '#164563' }} />
                                                            <Typography sx={{
                                                                fontFamily: 'Open Sans, sans-serif',
                                                                fontSize: '14px',
                                                                fontWeight: 400,
                                                                color: '#646464',
                                                            }}>
                                                                Loading chat history... This may take ~20 seconds
                                                            </Typography>
                                                        </div>
                                                    )}

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
                                                                            className="references-action-button"
                                                                            onClick={handleExportReferences}
                                                                            disabled={isExportDisabled}
                                                                            title="Export all references"
                                                                        >
                                                                            <DownloadIcon
                                                                                aria-label="Download references"
                                                                                style={{
                                                                                    width: '20px',
                                                                                    height: '20px',
                                                                                    display: 'block',
                                                                                    color: isExportDisabled ? '#B0B0B0' : '#164563',
                                                                                }}
                                                                            />
                                                                        </IconButton>
                                                                        <IconButton
                                                                            size="small"
                                                                            className="references-action-button"
                                                                            onClick={collapseReferences}
                                                                            sx={{ marginRight: '8px' }}
                                                                            title="Collapse references"
                                                                        >
                                                                            <ChevronRightIcon sx={{ color: '#164563' }} />
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
                                                                                    <ReferenceCard
                                                                                        url={url}
                                                                                        evidence={ref.evidence}
                                                                                        handleClick={handleClick}
                                                                                        onCiteClick={handleCiteClick}
                                                                                        isHighlighted={isHighlighted}
                                                                                    />
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
                                                <SidebarLeftIcon
                                                    className="references-collapse-icon"
                                                />
                                                <span className="references-collapse-label">REFERENCES</span>
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
