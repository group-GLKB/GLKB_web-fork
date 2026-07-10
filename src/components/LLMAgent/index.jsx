import './scoped.css';
// import github.css
import './github-markdown-light.css';

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { message } from 'antd';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import {
  UNSAFE_NavigationContext,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import {
  AccessTimeOutlined as AccessTimeOutlinedIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  EditNote as EditNoteIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  NotificationsNoneOutlined as NotificationsNoneOutlinedIcon,
  ScienceOutlined as ScienceOutlinedIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button as MuiButton,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import contentCopyIcon from '../../img/llm/content_copy.svg';
import { ReactComponent as DownloadIcon } from '../../img/llm/download_2.svg';
import replayIcon from '../../img/llm/replay.svg';
import thumbsUpDownIcon from '../../img/llm/thumbs_up_down.svg';
import { ReactComponent as AddIcon } from '../../img/navbar/add.svg';
import {
  ReactComponent as SidebarLeftIcon,
} from '../../img/navbar/sidebar.left.svg';
import { submitChatFeedback } from '../../service/Feedback';
import { LLMAgentService } from '../../service/LLMAgent';
import {
  getGuestTier,
  getMyTier,
  isFreePlanLimitReached,
} from '../../service/Tier';
import {
  createConversation,
  fetchConversationDetail,
  fetchConversations,
  getActiveConversationId,
  getConversations,
  setActiveConversationId,
  setConversations,
  updateConversationMessages,
  updateConversationTitle,
  upsertConversation,
} from '../../utils/chatHistory';
import {
  fetchConversationBookmarks,
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../utils/conversationBookmarks';
import { useAuth } from '../Auth/AuthContext';
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

const formatInvestigatedDuration = (durationMs) => {
    if (durationMs === null || durationMs === undefined) return '';
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getClarificationQuestionKey = (question, index) => {
    const raw = typeof question?.header === 'string' ? question.header.trim() : '';
    return raw || `question-${index}`;
};

const buildClarificationDrafts = (questions) => {
    if (!Array.isArray(questions)) return {};
    return questions.reduce((acc, question, index) => {
        const key = getClarificationQuestionKey(question, index);
        const defaults = Array.isArray(question?.default)
            ? question.default.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        acc[key] = {
            selected: defaults,
            text: '',
        };
        return acc;
    }, {});
};

const buildClarifyAnswers = (questions, drafts) => {
    if (!Array.isArray(questions)) return [];

    return questions.reduce((acc, question, index) => {
        const key = getClarificationQuestionKey(question, index);
        const draft = drafts?.[key] || { selected: [], text: '' };
        const header = typeof question?.header === 'string' ? question.header.trim() : key;
        const responseType = String(question?.response_type || 'text').toLowerCase();
        const selected = Array.isArray(draft.selected)
            ? draft.selected.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        const text = typeof draft.text === 'string' ? draft.text.trim() : '';

        if (responseType === 'text') {
            if (!text) return acc;
            acc.push({ header, selected: [], text });
            return acc;
        }

        if (responseType === 'single') {
            if (text) {
                acc.push({ header, selected: [], text });
                return acc;
            }
            if (selected[0]) {
                acc.push({ header, selected: [selected[0]], text: null });
            }
            return acc;
        }

        if (responseType === 'multi') {
            if (selected.length === 0 && !text) return acc;
            acc.push({
                header,
                selected,
                text: text || null,
            });
            return acc;
        }

        if (!selected.length && !text) return acc;
        acc.push({
            header,
            selected,
            text: text || null,
        });
        return acc;
    }, []);
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
const PUBMED_ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PLACEHOLDER_PMID_PREFIX = 'PMID ';

const LEFT_MIN_PX = 360;
const RIGHT_MIN_PX = 360;
const DIVIDER_PX = 8;
const DEFAULT_LEFT_PERCENT = 66;
const FALLBACK_MIN_LEFT_PERCENT = 45;
const FALLBACK_MAX_LEFT_PERCENT = 80;
const FALLBACK_COLLAPSE_THRESHOLD = 84;
const DEBUG_FORCE_LIMIT_WARNING = false;
const MOBILE_HEADER_NEW_CHAT_EVENT = 'glkb-mobile-header-new-chat';
const isPhoneUa = () => /Android|iPhone|iPod|Windows Phone|Mobile/i.test(window.navigator.userAgent || '');
const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;

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
            invocationId: leftMsg?.invocationId,
        });
        const rightSignature = JSON.stringify({
            role: rightMsg?.role,
            content: rightMsg?.content,
            timestamp: rightMsg?.timestamp,
            references: rightMsg?.references,
            thinkingSteps: rightMsg?.thinkingSteps,
            thoughtDurationMs: rightMsg?.thoughtDurationMs,
            trajectory: rightMsg?.trajectory,
            invocationId: rightMsg?.invocationId,
        });
        if (leftSignature !== rightSignature) return false;
    }

    return true;
};

const getStepLabel = (stepName) => {
    if (!stepName) return '';
    if (STEP_LABELS[stepName]) return STEP_LABELS[stepName];

    const toolMatch = String(stepName).match(/^TOOL\s+(?:CALL|RESULT):\s*(.+)$/i);
    if (toolMatch?.[1]) {
        const toolName = toolMatch[1].trim();
        return STEP_LABELS[toolName] || toolName.replace(/_/g, ' ');
    }

    const normalizedAgentStep = String(stepName).toUpperCase();
    if (normalizedAgentStep === 'AGENT START' || normalizedAgentStep === 'AGENT INPUT') {
        return STEP_LABELS.GLKBAgent || 'Agent is thinking';
    }
    if (normalizedAgentStep === 'AGENT OUTPUT') {
        return STEP_LABELS.FinalAnswerAgent || 'Formulating the final answer';
    }

    return stepName;
};

const extractYearFromPubDate = (value) => {
    if (!value || typeof value !== 'string') return '';
    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : '';
};

const extractPmidFromReference = (ref) => {
    if (!ref || typeof ref !== 'object') return null;
    const direct = String(ref.pmid || '').trim();
    if (/^\d+$/.test(direct)) return direct;

    const url = String(ref.url || '').trim();
    if (url) {
        const urlMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
        if (urlMatch?.[1]) return urlMatch[1];
    }

    const title = String(ref.title || '').trim();
    const titleMatch = title.match(/^PMID\s+(\d+)$/i);
    if (titleMatch?.[1]) return titleMatch[1];

    return null;
};

const isPlaceholderPmidReference = (ref) => {
    const pmid = extractPmidFromReference(ref);
    if (!pmid) return false;
    const title = String(ref.title || '').trim();
    return title === `${PLACEHOLDER_PMID_PREFIX}${pmid}`;
};

const fetchPubmedSummaryMap = async (pmids) => {
    if (!Array.isArray(pmids) || pmids.length === 0) return {};

    const params = new URLSearchParams();
    params.set('db', 'pubmed');
    params.set('id', pmids.join(','));
    params.set('retmode', 'json');

    const response = await fetch(`${PUBMED_ESUMMARY_URL}?${params.toString()}`, {
        method: 'GET',
        credentials: 'omit',
    });
    if (!response.ok) {
        throw new Error(`PubMed esummary request failed: ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.result;
    if (!result || typeof result !== 'object') return {};

    const map = {};
    pmids.forEach((pmid) => {
        const doc = result[pmid];
        if (!doc || typeof doc !== 'object') return;

        const title = typeof doc.title === 'string' ? doc.title.trim() : '';
        const journal = typeof doc.fulljournalname === 'string'
            ? doc.fulljournalname.trim()
            : (typeof doc.source === 'string' ? doc.source.trim() : '');
        const pubDate = typeof doc.pubdate === 'string' ? doc.pubdate : '';
        const sortDate = typeof doc.sortpubdate === 'string' ? doc.sortpubdate : '';
        const year = extractYearFromPubDate(pubDate) || extractYearFromPubDate(sortDate);
        const authors = Array.isArray(doc.authors)
            ? doc.authors
                .map((item) => (typeof item?.name === 'string' ? item.name.trim() : ''))
                .filter(Boolean)
                .join(', ')
            : '';

        map[pmid] = {
            title,
            journal,
            year,
            authors,
        };
    });

    return map;
};

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
    const stepFromEntry = typeof entry?.step === 'string' ? entry.step.trim() : '';
    const raw = entry?.content ?? '';
    const trimmed = raw.trim();
    if (!trimmed) {
        return { stepName: stepFromEntry || 'Step', line: raw };
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

    let derivedStepName = stepName;
    const normalizedAction = action.toUpperCase();
    if (normalizedAction) {
        if (normalizedAction === 'TOOL CALL' || normalizedAction === 'TOOL RESULT') {
            const toolName = stepName || 'Tool';
            derivedStepName = `${normalizedAction}: ${toolName}`;
        } else if (
            normalizedAction === 'AGENT START'
            || normalizedAction === 'AGENT INPUT'
            || normalizedAction === 'AGENT OUTPUT'
        ) {
            derivedStepName = normalizedAction;
        } else {
            derivedStepName = action;
        }
    }

    const isGenericTransportStep = (
        stepFromEntry === 'Processing'
        || stepFromEntry === 'Started'
        || stepFromEntry === 'Complete'
    );

    if (derivedStepName && STEP_LABELS[derivedStepName]) {
        stepName = derivedStepName;
    } else if (stepFromEntry && STEP_LABELS[stepFromEntry]) {
        stepName = stepFromEntry;
    } else if (derivedStepName) {
        stepName = derivedStepName;
    } else if (stepFromEntry && !isGenericTransportStep) {
        stepName = stepFromEntry;
    } else {
        stepName = 'Step';
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
    onOpenFeedback,
}) {
    const isAssistant = message.role === "assistant";
    const isLastUserMessage = index === totalMessages - 1 && message.role === 'assistant';
    const isLoading = isProcessing && isLastUserMessage;
    const messageID = index;
    const isSelected = index === selectedMessageIndex;
    const hasReferences = Array.isArray(message.references) && message.references.length > 0;
    const allowUserEdit = true;
    const [editContent, setEditContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [thoughtsExpanded, setThoughtsExpanded] = useState(() => isLoading);
    const [animatedStepLabel, setAnimatedStepLabel] = useState('');
    const [stepLabelPhase, setStepLabelPhase] = useState('idle');
    const [investigateExpanded, setInvestigateExpanded] = useState(true);
    const allowResponseRefresh = true;
    const stepLabelTimersRef = useRef([]);
    const renderedStepLabelRef = useRef('');
    const thoughtDurationLabel = formatDuration(message.thoughtDurationMs);
    const investigatedDurationLabel = formatInvestigatedDuration(message.thoughtDurationMs);
    const isInvestigateMessage = Boolean(message.investigateMode);
    const groupedThoughts = useMemo(
        () => groupThinkingSteps(message.thinkingSteps),
        [message.thinkingSteps]
    );
    const trajectoryGroups = useMemo(
        () => trajectoryToGroups(message.trajectory),
        [message.trajectory]
    );
    const activeStreamingGroups = isLoading ? streamingGroups : [];
    const staticGroups = !isLoading
        ? (
            (isInvestigateMessage && groupedThoughts.length)
                ? groupedThoughts
                : (trajectoryGroups.length ? trajectoryGroups : groupedThoughts)
        )
        : groupedThoughts;
    const displayGroups = isLoading ? activeStreamingGroups : staticGroups;
    const hasDisplayGroups = displayGroups.length > 0;
    const isTrajectoryDisplay = !isLoading && !isInvestigateMessage && trajectoryGroups.length > 0;
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
    const showInvestigateProgress = isAssistant && isInvestigateMessage && isLoading;
    const showInvestigateSummary = isAssistant && isInvestigateMessage && !isLoading && Boolean(investigatedDurationLabel);
    const showThoughtHeader = isAssistant && (
        !isInvestigateMessage && (isLoading || thoughtDurationLabel || hasDisplayGroups)
    );
    const showReloadInMessage = showReloadPrompt && isLastUserMessage && isAssistant && !isLoading;
    const canToggleThoughts = !isLoading && hasDisplayGroups;
    const investigateStageLabels = ['Retrieved', 'Screened', 'Extracted', 'Cited'];
    const investigateStageIndex = useMemo(() => {
        if (!showInvestigateProgress) return -1;
        const step = (streamingStepName || activeStreamingGroups[activeStreamingGroups.length - 1]?.name || '').toLowerCase();
        if (/cite|reference|pmid/.test(step)) return 3;
        if (/extract|evidence|read|fulltext/.test(step)) return 2;
        if (/screen|rank|filter/.test(step)) return 1;
        if (/retriev|search|query/.test(step)) return 0;
        return Math.min(3, Math.max(0, activeStreamingGroups.length - 1));
    }, [showInvestigateProgress, streamingStepName, activeStreamingGroups]);
    const investigateActivityItems = useMemo(() => {
        const raw = activeStreamingGroups
            .flatMap((group) => Array.isArray(group.lines) ? group.lines : [])
            .map((line) => String(line || '').replace(/^[-•\s]+/, '').trim())
            .filter((line) => line.length >= 12);
        return Array.from(new Set(raw));
    }, [activeStreamingGroups]);

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
        if (showInvestigateProgress) {
            setInvestigateExpanded(true);
        }
    }, [showInvestigateProgress]);

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
        const SWAP_MS = 16;

        setStepLabelPhase('out');
        const outTimer = setTimeout(() => {
            renderedStepLabelRef.current = loadingStepLabel;
            setAnimatedStepLabel(loadingStepLabel);
            setStepLabelPhase('swap');
            const swapTimer = setTimeout(() => {
                setStepLabelPhase('in');
                const inTimer = setTimeout(() => {
                    setStepLabelPhase('idle');
                }, IN_MS);
                stepLabelTimersRef.current.push(inTimer);
            }, SWAP_MS);
            stepLabelTimersRef.current.push(swapTimer);
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
                    <Box sx={{ flex: 1, maxWidth: "100%" }}>
                        {showInvestigateSummary && (
                            <Box
                                className={`investigate-summary-row${canToggleThoughts ? ' can-toggle' : ''}`}
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
                                aria-label={canToggleThoughts ? (thoughtsExpanded ? 'Collapse investigation thoughts' : 'Expand investigation thoughts') : undefined}
                            >
                                <ScienceOutlinedIcon className="investigate-summary-icon" />
                                <span className="investigate-summary-text">Investigated for {investigatedDurationLabel}</span>
                                {canToggleThoughts && (
                                    <ChevronRightIcon className={`investigate-summary-chevron${thoughtsExpanded ? ' expanded' : ''}`} />
                                )}
                            </Box>
                        )}

                        {showInvestigateProgress && (
                            <Box className="investigate-progress-shell">
                                <Box
                                    className="investigate-progress-head"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setInvestigateExpanded((prev) => !prev)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setInvestigateExpanded((prev) => !prev);
                                        }
                                    }}
                                >
                                    <Box className="investigate-progress-head-left">
                                        <ScienceOutlinedIcon className="investigate-progress-head-icon" />
                                        <span className="investigate-progress-head-title">Mapping your question into research angles...</span>
                                        <ExpandMoreIcon className={`investigate-progress-head-caret${investigateExpanded ? ' expanded' : ''}`} />
                                    </Box>
                                    <Box className="investigate-progress-head-right">
                                        <span className="investigate-progress-time"><AccessTimeOutlinedIcon fontSize="inherit" />~6 min</span>
                                        <span className="investigate-progress-notify"><NotificationsNoneOutlinedIcon fontSize="inherit" />Notify me</span>
                                    </Box>
                                </Box>

                                {investigateExpanded && (
                                    <Box className="investigate-progress-body">
                                        <Box className="investigate-progress-stages">
                                            {investigateStageLabels.map((label, stageIndex) => (
                                                <Box key={label} className="investigate-progress-stage">
                                                    <span className={`investigate-progress-stage-bar${stageIndex <= investigateStageIndex ? ' done' : ''}`} />
                                                    <span className="investigate-progress-stage-label">{label}</span>
                                                </Box>
                                            ))}
                                        </Box>

                                        {investigateActivityItems.length > 0 && (
                                            <Box className="investigate-progress-angles">
                                                <span className="investigate-progress-angles-title">Research activity ({investigateActivityItems.length} steps):</span>
                                                {investigateActivityItems.map((item, itemIndex) => (
                                                    <span key={`${item}-${itemIndex}`} className="investigate-progress-angle-item">- {item}</span>
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        )}

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
                                        padding: '4px 0',
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
                                {!isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={() => copy(message.content)}
                                        title="Copy response"
                                        aria-label="Copy response"
                                    >
                                        <img
                                            src={contentCopyIcon}
                                            alt="Copy"
                                            style={{ width: '16px', height: '16px', display: 'block', objectFit: 'contain' }}
                                        />
                                    </IconButton>
                                )}
                                {allowResponseRefresh && isLastUserMessage && !isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={() => refresh(null, index)}
                                        title="Regenerate response"
                                    >
                                        <img
                                            src={replayIcon}
                                            alt="Refresh"
                                            style={{ width: '16px', height: '16px', display: 'block', objectFit: 'contain' }}
                                        />
                                    </IconButton>
                                )}
                                {!isLoading && <IconButton size="small" onClick={() => downloadConversation(messageID)} title="Download this Q&A">
                                    <DownloadIcon
                                        aria-label="Download"
                                        style={{ width: '16px', height: '16px', display: 'block', color: '#646464' }}
                                    />
                                </IconButton>}
                                {!isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={onOpenFeedback}
                                        title="Share feedback"
                                    >
                                        <img
                                            src={thumbsUpDownIcon}
                                            alt="Feedback"
                                            style={{ width: '16px', height: '16px', display: 'block', objectFit: 'contain' }}
                                        />
                                    </IconButton>
                                )}
                            </Stack>
                            <MuiButton
                                variant='contained'
                                startIcon={<LinkIcon />}
                                size="small"
                                onClick={() => goref(messageID)}
                                disabled={isLoading || !hasReferences}
                                sx={{
                                    px: "10px",
                                    fontFamily: 'Open Sans, sans-serif',
                                    fontWeight: isSelected ? 600 : 500,
                                    height: "34px",
                                    borderRadius: "16px",
                                    border: isSelected ? "1px solid #155DFC" : "none",
                                    bgcolor: isSelected ? "#f7f8fa" : "#E7F1FF",
                                    color: "#155DFC",
                                    boxShadow: isSelected ? "0 1px 2px rgba(21, 93, 252, 0.12)" : "none",
                                    "& .MuiButton-startIcon": {
                                        color: "#155DFC",
                                    },
                                    "& .MuiSvgIcon-root": {
                                        color: "#155DFC",
                                    },
                                    "&:hover": {
                                        bgcolor: isSelected ? "#EEF1F6" : "#EEF6FF",
                                        color: "#155DFC",
                                        borderColor: "#155DFC",
                                        boxShadow: isSelected ? "0 1px 2px rgba(21, 93, 252, 0.16)" : "none",
                                    },
                                    "&.Mui-disabled": {
                                        color: "#A0A8B5",
                                        backgroundColor: "#EFF3F8",
                                        border: "none",
                                        boxShadow: "none",
                                        fontWeight: 500,
                                    },
                                    "&.Mui-disabled .MuiButton-startIcon": {
                                        color: "#A0A8B5",
                                    },
                                    "&.Mui-disabled .MuiSvgIcon-root": {
                                        color: "#A0A8B5",
                                    },
                                    mb: "2px"
                                }}
                            >
                                References
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
                            <IconButton
                                size="small"
                                onClick={() => copy(message.content)}
                                title="Copy message"
                                aria-label="Copy message"
                            >
                                <img
                                    src={contentCopyIcon}
                                    alt="Copy"
                                    style={{ width: '16px', height: '16px', display: 'block', objectFit: 'contain' }}
                                />
                            </IconButton>
                            {allowUserEdit && (
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        if (!allowUserEdit || isAssistant) return;

                                        setIsEditing(true);
                                        setEditContent(message.content);
                                    }}
                                >
                                    <EditNoteIcon fontSize="small" />
                                </IconButton>
                            )}
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
    const [isPhoneDevice, setIsPhoneDevice] = useState(false);
    const [isMobileReferencesDrawerOpen, setIsMobileReferencesDrawerOpen] = useState(false);
    const [conversationsState, setConversationsState] = useState(() => getConversations());
    const [activeConversationId, setActiveConversationIdState] = useState(() => getActiveConversationId());
    const [isConversationLoading, setIsConversationLoading] = useState(false);
    const [loadingConversationId, setLoadingConversationId] = useState(null);
    const [conversationBookmarks, setConversationBookmarksState] = useState(() => getConversationBookmarks());
    const [showReloadPrompt, setShowReloadPrompt] = useState(
        () => getStoredProcessingFlag() || getStoredIncompleteFlag()
    );
    const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [feedbackSuccessOpen, setFeedbackSuccessOpen] = useState(false);
    const [feedbackSuccessText, setFeedbackSuccessText] = useState('Feedback submitted.');
    const [isEditingChatTitle, setIsEditingChatTitle] = useState(false);
    const [chatTitleDraft, setChatTitleDraft] = useState('');
    const [isQueryLimitReached, setIsQueryLimitReached] = useState(false);
    const [queryLimitTotal, setQueryLimitTotal] = useState(10);
    const [pendingClarification, setPendingClarification] = useState(null);
    const [clarificationDrafts, setClarificationDrafts] = useState({});
    const [clarificationError, setClarificationError] = useState('');
    const [clarificationSubmitting, setClarificationSubmitting] = useState(false);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const thinkingStepsRef = useRef([]);
    const prevSelectedMessageIndexRef = useRef(null);
    const lastAutoSelectedRef = useRef(null);
    const sessionIdRef = useRef(null);
    const hasConsumedInitialQueryRef = useRef(false);
    const initialSearchOptionsRef = useRef(null);
    const activeConversationIdRef = useRef(getActiveConversationId());
    const loadingConversationIdRef = useRef(null);
    const activeStreamIdRef = useRef(null);
    const splitContainerRef = useRef(null);
    const isDraggingSplitRef = useRef(false);
    const navigationBypassRef = useRef(false);
    const originalNavigatorMethodsRef = useRef({ push: null, replace: null });
    const navigate = useNavigate();
    const { navigator: routerNavigator } = useContext(UNSAFE_NavigationContext);
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const useMobileReferencesDrawer = isPhoneDevice;

    useEffect(() => {
        const evaluateIsPhone = () => {
            setIsPhoneDevice(isPhoneUa() && isPhoneViewport());
        };

        evaluateIsPhone();
        window.addEventListener('resize', evaluateIsPhone);
        return () => {
            window.removeEventListener('resize', evaluateIsPhone);
        };
    }, []);

    useEffect(() => {
        if (!useMobileReferencesDrawer) {
            setIsMobileReferencesDrawerOpen(false);
        }
    }, [useMobileReferencesDrawer]);

    useEffect(() => {
        if (!routerNavigator) return undefined;

        if (!originalNavigatorMethodsRef.current.push && typeof routerNavigator.push === 'function') {
            originalNavigatorMethodsRef.current.push = routerNavigator.push.bind(routerNavigator);
        }
        if (!originalNavigatorMethodsRef.current.replace && typeof routerNavigator.replace === 'function') {
            originalNavigatorMethodsRef.current.replace = routerNavigator.replace.bind(routerNavigator);
        }

        if (!isLoading) {
            if (originalNavigatorMethodsRef.current.push) {
                routerNavigator.push = originalNavigatorMethodsRef.current.push;
            }
            if (originalNavigatorMethodsRef.current.replace) {
                routerNavigator.replace = originalNavigatorMethodsRef.current.replace;
            }
            return undefined;
        }

        const guardedPush = (...args) => {
            if (navigationBypassRef.current && originalNavigatorMethodsRef.current.push) {
                originalNavigatorMethodsRef.current.push(...args);
                return;
            }
            setPendingNavigation({ method: 'push', args });
            setShowLeaveConfirmDialog(true);
        };

        const guardedReplace = (...args) => {
            if (navigationBypassRef.current && originalNavigatorMethodsRef.current.replace) {
                originalNavigatorMethodsRef.current.replace(...args);
                return;
            }
            setPendingNavigation({ method: 'replace', args });
            setShowLeaveConfirmDialog(true);
        };

        routerNavigator.push = guardedPush;
        routerNavigator.replace = guardedReplace;

        return () => {
            if (originalNavigatorMethodsRef.current.push) {
                routerNavigator.push = originalNavigatorMethodsRef.current.push;
            }
            if (originalNavigatorMethodsRef.current.replace) {
                routerNavigator.replace = originalNavigatorMethodsRef.current.replace;
            }
        };
    }, [isLoading, routerNavigator]);

    useEffect(() => {
        if (isLoading) return;
        setShowLeaveConfirmDialog(false);
        setPendingNavigation(null);
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading) return undefined;

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isLoading]);

    const handleLeaveDialogCancel = () => {
        setShowLeaveConfirmDialog(false);
        setPendingNavigation(null);
    };

    const handleLeaveDialogConfirm = () => {
        setShowLeaveConfirmDialog(false);
        if (pendingNavigation) {
            const method = pendingNavigation.method;
            const args = pendingNavigation.args || [];
            const fn = originalNavigatorMethodsRef.current[method];
            if (typeof fn === 'function') {
                navigationBypassRef.current = true;
                fn(...args);
                navigationBypassRef.current = false;
            }
        }
        setPendingNavigation(null);
    };

    const refreshTierStatus = useCallback(async () => {
        if (authLoading) {
            setIsQueryLimitReached(false);
            setQueryLimitTotal(10);
            return;
        }
        const result = isAuthenticated ? await getMyTier() : await getGuestTier();
        if (!result.success) return;
        setIsQueryLimitReached(isFreePlanLimitReached(result.data));
        setQueryLimitTotal(Number(result.data?.quota_limit) || 10);
    }, [authLoading, isAuthenticated]);

    const llmService = useMemo(() => new LLMAgentService(), []);
    const isLimitReachedEffective = isQueryLimitReached || DEBUG_FORCE_LIMIT_WARNING;
    const showLimitWarning = isLimitReachedEffective;
    const displayedQueryLimit = Number.isFinite(Number(queryLimitTotal)) && Number(queryLimitTotal) > 0
        ? Number(queryLimitTotal)
        : 10;
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
        if (authLoading || !isAuthenticated) {
            setConversationBookmarksState([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getConversationBookmarks();
            if (!isMounted) return;
            setConversationBookmarksState(next);
        };

        fetchConversationBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setConversationBookmarksState(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-conversation-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-conversation-bookmarks-updated', update);
        };
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        refreshTierStatus();
    }, [refreshTierStatus]);

    useEffect(() => {
        if (authLoading) return undefined;
        let isMounted = true;

        const initializeConversations = async () => {
            if (!isAuthenticated) {
                setConversationsState([]);
                setActiveConversationIdState(null);
                activeConversationIdRef.current = null;
                setIsConversationLoading(false);
                setLoadingConversationId(null);
                return;
            }

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
    }, [authLoading, isAuthenticated, location.state?.initialQuery, location.state?.conversationId]);

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
        setPendingClarification(null);
        setClarificationDrafts({});
        setClarificationError('');
        setClarificationSubmitting(false);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
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
    }, [isAuthenticated, location.state, cancelStreaming, llmService]);

    const startNewConversation = useCallback(() => {
        cancelStreaming();
        setChatHistory([]);
        setSelectedMessageIndex(null);
        lastAutoSelectedRef.current = null;
        setHoveredPubmedId(null);
        sessionIdRef.current = null;
        setStreamingStepName('');
        setShowReloadPrompt(false);
        setPendingClarification(null);
        setClarificationDrafts({});
        setClarificationError('');
        setClarificationSubmitting(false);
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

    const handleReferenceEntryContainerClick = (event, link) => {
        if (event.target.closest('.custom-div-url')) return;
        handleClick(event, link);
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
            initialSearchOptionsRef.current = location.state.initialSearchOptions || null;
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
            } else if (useMobileReferencesDrawer) {
                setIsMobileReferencesDrawerOpen(true);
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
    }, [chatHistory, expandReferences, isReferencesCollapsed, useMobileReferencesDrawer]);

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
            const pmid = ref?.pmid || null;
            const citationCount = ref?.n_citation ?? ref?.citation_count ?? 0;
            const year = ref?.date ?? ref?.year ?? '';
            const journal = ref?.journal || '';
            const authors = Array.isArray(ref?.authors) ? ref.authors.join(', ') : 'Authors not available';
            const evidence = Array.isArray(ref?.evidence) ? ref.evidence : [];
            return {
                pmid,
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
        if (!inputText.trim() || isLoading || isLimitReachedEffective) return;

        const shouldStartNewConversation = options.forceNewConversation || !activeConversationIdRef.current;
        const baseHistory = Array.isArray(options.baseHistory)
            ? options.baseHistory
            : (shouldStartNewConversation ? [] : chatHistory);
        const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeStreamIdRef.current = streamId;

        setShowReloadPrompt(false);

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const requestStartedAt = Date.now();

        const requestSearchOptions = options.searchOptions || initialSearchOptionsRef.current || null;
        initialSearchOptionsRef.current = null;
        const investigateEnabled = Boolean(requestSearchOptions?.investigateEnabled);

        // Create new user message
        const newMessage = {
            role: 'user',
            content: inputText,
            references: [],
            timestamp: t || timestamp,
            investigateMode: investigateEnabled,
        };

        let historyId = activeConversationIdRef.current;
        if (shouldStartNewConversation && isAuthenticated) {
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
        setPendingClarification(null);
        setClarificationDrafts({});
        setClarificationError('');
        setClarificationSubmitting(false);
        thinkingStepsRef.current = [];

        try {
            logDev('[LLM] submit', { input: inputText });

            // Append a blank message
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: '',
                references: [],
                timestamp: timestamp,
                thinkingSteps: [],
                thoughtDurationMs: null,
                trajectory: null,
                investigateMode: investigateEnabled,
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
                    case 'clarification':
                        if (!isActiveStream) return;
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        setPendingClarification({
                            invocationId: update.invocationId || null,
                            stage: update.stage || null,
                            sessionId: update.sessionId || sessionIdRef.current || null,
                            reason: update.reason || '',
                            questions: Array.isArray(update.questions) ? update.questions : [],
                        });
                        setClarificationDrafts(buildClarificationDrafts(update.questions));
                        setClarificationError('');
                        setClarificationSubmitting(false);
                        break;
                    case 'step':
                        if (!isActiveStream) return;
                        {
                            const rawContent = update.content ?? '';
                            const hasContent = Boolean(rawContent.trim());
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
                                        thoughtDurationMs: Date.now() - requestStartedAt,
                                        investigateMode: investigateEnabled,
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
                                if (parsedEntry.stepName) {
                                    setStreamingStepName(parsedEntry.stepName);
                                }

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
                        setPendingClarification(null);
                        setClarificationDrafts({});
                        setClarificationError('');
                        setClarificationSubmitting(false);
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
                                investigateMode: investigateEnabled,
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
                            if (update.invocationId) {
                                setChatHistory((prev) => {
                                    const next = [...prev];
                                    let assistantIndex = -1;
                                    for (let i = next.length - 1; i >= 0; i -= 1) {
                                        if (next[i]?.role === 'assistant') {
                                            assistantIndex = i;
                                            break;
                                        }
                                    }
                                    if (assistantIndex < 0) return prev;
                                    const userIndex = assistantIndex - 1;
                                    if (userIndex < 0) return prev;
                                    next[userIndex] = { ...next[userIndex], invocationId: update.invocationId };
                                    next[assistantIndex] = { ...next[assistantIndex], invocationId: update.invocationId };
                                    return next;
                                });
                            }
                        }
                        if (isAuthenticated) {
                            fetchConversations()
                                .then((list) => setConversationsState(list))
                                .catch((error) => logDev('[LLM] Failed to refresh conversations', error));
                        }
                        break;
                    }
                    case 'error': // unsure if this is used
                        if (!isActiveStream) return;
                        setPendingClarification(null);
                        setClarificationDrafts({});
                        setClarificationError('');
                        setClarificationSubmitting(false);
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
                                thoughtDurationMs: Date.now() - requestStartedAt,
                                investigateMode: investigateEnabled,
                            };
                            newHistory[newHistory.length - 1] = errorMessage;
                            return newHistory;
                        });
                        break;
                }
            }, {
                historyId,
                sessionId: sessionIdRef.current,
                filters: Array.isArray(requestSearchOptions?.filters) ? requestSearchOptions.filters : undefined,
                rankingMode: typeof requestSearchOptions?.rankingMode === 'string' ? requestSearchOptions.rankingMode : undefined,
                investigateEnabled: Boolean(requestSearchOptions?.investigateEnabled),
                messagesOverride: [...baseHistory, newMessage].map((msg) => ({
                    role: msg?.role,
                    content: msg?.content,
                })),
            });
        } catch (error) {
            console.error('Error in chat:', error);
            if (error?.response?.status === 429) {
                setIsQueryLimitReached(true);
            }
            if (activeStreamIdRef.current === streamId) {
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const errorMessage = {
                        role: 'assistant',
                        content: 'Sorry, I encountered an error while processing your request. Please try again.',
                        references: [],
                        timestamp: timestamp,
                        thinkingSteps: thinkingStepsRef.current,
                        thoughtDurationMs: Date.now() - requestStartedAt,
                        investigateMode: investigateEnabled,
                    };
                    newHistory[newHistory.length - 1] = errorMessage;
                    return newHistory;
                });
            }
        } finally {
            refreshTierStatus();
            if (activeStreamIdRef.current === streamId) {
                setIsLoading(false);
                setIsProcessing(false);
                activeStreamIdRef.current = null;
                setPendingClarification(null);
                setClarificationDrafts({});
                setClarificationError('');
                setClarificationSubmitting(false);
            }
        }
    };

    const updateClarificationDraft = useCallback((questionKey, nextDraft) => {
        setClarificationDrafts((prev) => ({
            ...prev,
            [questionKey]: {
                selected: Array.isArray(nextDraft?.selected) ? nextDraft.selected : [],
                text: typeof nextDraft?.text === 'string' ? nextDraft.text : '',
            },
        }));
    }, []);

    const submitClarification = useCallback(async ({ useDefaults = false } = {}) => {
        if (!pendingClarification?.invocationId || !pendingClarification?.stage || !pendingClarification?.sessionId) {
            setClarificationError('Clarification session has expired. Please ask your question again.');
            return;
        }

        setClarificationSubmitting(true);
        setClarificationError('');
        try {
            const answers = useDefaults
                ? []
                : buildClarifyAnswers(pendingClarification.questions, clarificationDrafts);

            const result = await llmService.clarify({
                invocation_id: pendingClarification.invocationId,
                stage: pendingClarification.stage,
                session_id: pendingClarification.sessionId,
                answers,
            });

            setPendingClarification(null);
            setClarificationDrafts({});
            setClarificationError('');
            setClarificationSubmitting(false);

            if (result?.resolved === false) {
                message.info('Clarification session not found. Continuing with default research scope.');
            }
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.message || 'Unable to submit clarification.';
            setClarificationError(String(detail));
            setClarificationSubmitting(false);
        }
    }, [clarificationDrafts, llmService, pendingClarification]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    const handleSaveEdit = async (e, index, content) => {
        if (content.trim() === '' || isLoading) return;
        const historyId = activeConversationIdRef.current;
        if (!historyId) return;
        const invocationId = await ensureInvocationIdForIndex(index);
        if (!invocationId) {
            message.error('Unable to edit this message right now.');
            return;
        }

        try {
            await llmService.rewind(historyId, invocationId);
        } catch (error) {
            message.error('Unable to rewind conversation. Please try again.');
            return;
        }
        const editedHistory = chatHistory.slice(0, index);
        setChatHistory(editedHistory);
        setShowReloadPrompt(false);
        handleSubmit(e, content, null, { baseHistory: editedHistory });
    };

    const handleCopyMessage = (content) => {
        if (!window.navigator?.clipboard?.writeText) {
            message.error('Copy is not supported in this browser context.');
            return;
        }

        window.navigator.clipboard.writeText(content)
            .then(() => {
                message.success('Content copied to clipboard');
            })
            .catch(err => {
                console.error('Failed to copy content: ', err);
                message.error('Copy failed, please select and copy manually');
            });
    };

    const handleClear = useCallback(() => {
        startNewConversation();
        navigate('/');
    }, [navigate, startNewConversation]);

    useEffect(() => {
        const handleMobileHeaderNewChat = () => {
            handleClear();
        };

        window.addEventListener(MOBILE_HEADER_NEW_CHAT_EVENT, handleMobileHeaderNewChat);
        return () => {
            window.removeEventListener(MOBILE_HEADER_NEW_CHAT_EVENT, handleMobileHeaderNewChat);
        };
    }, [handleClear]);

    const handleToggleConversationBookmark = async () => {
        if (authLoading) return;
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return;
        const entry = {
            id: String(currentId),
            title: chatTitle,
            updatedAt: activeConversation?.updatedAt || new Date().toISOString(),
            messageCount: activeConversation?.messageCount ?? chatHistory.length,
        };
        try {
            const next = await toggleConversationBookmark(entry);
            setConversationBookmarksState(next);
        } catch (error) {
            setConversationBookmarksState(getConversationBookmarks());
        }
    };

    const handleEditChatTitle = () => {
        if (authLoading) return;
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return;
        setChatTitleDraft(chatTitle || '');
        setIsEditingChatTitle(true);
    };

    const handleCancelChatTitleEdit = () => {
        setIsEditingChatTitle(false);
        setChatTitleDraft('');
    };

    const handleConfirmChatTitleEdit = async () => {
        if (authLoading) return;
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        const currentId = activeConversationIdRef.current || activeConversationId;
        if (!currentId) return;
        const currentTitle = chatTitle || '';
        const trimmed = chatTitleDraft.trim();
        if (!trimmed || trimmed === currentTitle) {
            handleCancelChatTitleEdit();
            return;
        }
        try {
            await updateConversationTitle(currentId, trimmed);
            setConversationsState(getConversations());
            handleCancelChatTitleEdit();
        } catch (error) {
            message.error('Unable to update chat title');
        }
    };

    const handleMessageClick = (index) => {
        if (chatHistory[index].role === 'assistant') {
            if (useMobileReferencesDrawer) {
                setIsMobileReferencesDrawerOpen(true);
            } else if (isReferencesCollapsed) {
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

    const getInvocationIdForTurn = (messages, targetIndex) => {
        if (!Array.isArray(messages)) return null;
        const direct = messages[targetIndex]?.invocationId;
        if (direct) return direct;
        const prev = messages[targetIndex - 1];
        return prev?.invocationId || null;
    };

    const ensureInvocationIdForIndex = async (targetIndex) => {
        const existing = getInvocationIdForTurn(chatHistory, targetIndex);
        if (existing) return existing;
        const historyId = activeConversationIdRef.current;
        if (!historyId) return null;
        try {
            const detail = await fetchConversationDetail(historyId);
            const refreshed = detail?.messages || [];
            setChatHistory(refreshed);
            return getInvocationIdForTurn(refreshed, targetIndex);
        } catch (error) {
            return null;
        }
    };

    const handleRegenerateResponse = async (e, index) => {
        if (isLoading) return;
        const historyId = activeConversationIdRef.current;
        if (!historyId) return;

        const assistantMessage = chatHistory[index];
        if (!assistantMessage || assistantMessage.role !== 'assistant') return;
        const userMessage = chatHistory[index - 1];
        if (!userMessage || userMessage.role !== 'user') return;

        const invocationId = await ensureInvocationIdForIndex(index);
        if (!invocationId) {
            message.error('Unable to regenerate this response right now.');
            return;
        }

        try {
            await llmService.rewind(historyId, invocationId);
        } catch (error) {
            message.error('Unable to rewind conversation. Please try again.');
            return;
        }
        const trimmedHistory = chatHistory.slice(0, index - 1);
        setChatHistory(trimmedHistory);
        setShowReloadPrompt(false);
        handleSubmit(e, userMessage.content, null, { baseHistory: trimmedHistory });
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

    const renderMessages = () => {
        return (<Box sx={{ p: isPhoneDevice ? 1 : 2 }}>{chatHistory.map((message, index) => (
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
                onOpenFeedback={handleOpenFeedback}
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
    const [referenceSummaryMap, setReferenceSummaryMap] = useState({});
    const referenceSummaryPendingRef = useRef(new Set());

    useEffect(() => {
        const candidates = Array.from(new Set(
            references
                .filter(isPlaceholderPmidReference)
                .map((ref) => extractPmidFromReference(ref))
                .filter((pmid) => pmid && !referenceSummaryMap[pmid] && !referenceSummaryPendingRef.current.has(pmid))
        ));

        if (candidates.length === 0) return;

        candidates.forEach((pmid) => referenceSummaryPendingRef.current.add(pmid));

        fetchPubmedSummaryMap(candidates)
            .then((incomingMap) => {
                if (!incomingMap || typeof incomingMap !== 'object') return;
                setReferenceSummaryMap((prev) => ({
                    ...prev,
                    ...incomingMap,
                }));
            })
            .catch((error) => {
                logDev('[LLM] Failed to enrich placeholder references via esummary', error);
            })
            .finally(() => {
                candidates.forEach((pmid) => referenceSummaryPendingRef.current.delete(pmid));
            });
    }, [references, referenceSummaryMap]);

    const enrichedReferences = useMemo(
        () => references.map((ref) => {
            const pmid = extractPmidFromReference(ref);
            if (!pmid || !isPlaceholderPmidReference(ref)) return ref;

            const summary = referenceSummaryMap[pmid];
            if (!summary) return ref;

            return {
                ...ref,
                pmid,
                title: summary.title || ref.title,
                journal: summary.journal || ref.journal,
                year: summary.year || ref.year,
                authors: summary.authors || ref.authors,
                citation_count: 'N/A',
            };
        }),
        [references, referenceSummaryMap]
    );

    useEffect(() => {
        if (!hoveredPubmedId) return;
        const isStillVisible = enrichedReferences.some((ref) => {
            const pubmedId = extractPmidFromReference(ref);
            return pubmedId === hoveredPubmedId;
        });
        if (!isStillVisible) {
            setHoveredPubmedId(null);
        }
    }, [hoveredPubmedId, enrichedReferences]);

    const sortedReferences = useMemo(() => {
        const sorted = [...enrichedReferences];
        const getCitationSortValue = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : -1;
        };
        if (sortOption === 'Citations') {
            sorted.sort((a, b) => getCitationSortValue(b.citation_count) - getCitationSortValue(a.citation_count));
        } else {
            sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
        }
        return sorted;
    }, [enrichedReferences, sortOption]);
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

    const handleOpenFeedback = () => {
        setFeedbackRating(0);
        setFeedbackText('');
        setFeedbackOpen(true);
    };

    const handleCloseFeedback = () => {
        setFeedbackOpen(false);
        setFeedbackRating(0);
        setFeedbackText('');
        setFeedbackSubmitting(false);
    };

    const handleSubmitFeedback = async () => {
        if (!Number.isInteger(feedbackRating) || feedbackRating < 1 || feedbackRating > 5) {
            message.error('Please select a rating from 1 to 5 stars.');
            return;
        }

        const historyId = activeConversationIdRef.current || activeConversationId;
        if (!historyId) {
            message.error('Unable to submit feedback: conversation hid is missing.');
            return;
        }

        try {
            setFeedbackSubmitting(true);
            const submittedSessionId = String(historyId);
            const response = await submitChatFeedback({
                sessionId: submittedSessionId,
                rating: feedbackRating,
                feedback: feedbackText.trim(),
            });

            if (response?.ok !== true) {
                throw new Error(response?.message || 'Feedback submission failed.');
            }

            if (typeof response?.message === 'string' && /not\s*found/i.test(response.message)) {
                throw new Error('Conversation not found for current user.');
            }

            const updatedHint = response?.updated ? ' Existing feedback was updated.' : '';
            setFeedbackSuccessText(`${response?.message || 'Feedback submitted'}${updatedHint}`.trim());
            setFeedbackSuccessOpen(true);
            handleCloseFeedback();
        } catch (error) {
            const backendDetail = error.response?.data?.detail || error.response?.data?.message || error.message;
            const submittedSessionId = String(historyId);
            const normalizedDetail = typeof backendDetail === 'string' ? backendDetail.trim() : '';
            const isRouteNotFound = error.response?.status === 404
                && /^not\s+found$/i.test(normalizedDetail || '');
            const isConversationNotFound =
                /conversation\s+not\s+found|session[_\s-]*id.*not\s+exist|belongs\s+to\s+a\s+different\s+user/i
                    .test(normalizedDetail || '');

            if (isRouteNotFound) {
                message.error(`Feedback API endpoint not found. session_id=${submittedSessionId}. Please verify backend route deployment.`);
            } else if (isConversationNotFound) {
                message.error(`Conversation not found for current user (session_id=${submittedSessionId}). Please reopen this chat and try again.`);
            } else {
                message.error((normalizedDetail || 'Failed to submit feedback. Please try again.'));
            }
            setFeedbackSubmitting(false);
        }
    };

    const handleCloseFeedbackSuccess = (_, reason) => {
        if (reason === 'clickaway') return;
        setFeedbackSuccessOpen(false);
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
                <meta name="description" content="Ask, Analyze, Cite. Start a chat now with GLKB, your scientific research AI assistant." />
                <meta property="og:title" content="AI Chat - Genomic Literature Knowledge Base | AI-Powered Genomics Search" />
                <meta property="og:description" content="Ask, Analyze, Cite. Start a chat now with GLKB, your scientific research AI assistant." />
            </Helmet>

            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />

            <Snackbar
                open={feedbackSuccessOpen}
                autoHideDuration={3000}
                onClose={handleCloseFeedbackSuccess}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    severity="success"
                    variant="filled"
                    onClose={handleCloseFeedbackSuccess}
                    sx={{ width: '100%' }}
                >
                    {feedbackSuccessText}
                </Alert>
            </Snackbar>

            <Dialog
                open={Boolean(pendingClarification)}
                onClose={() => {}}
                disableEscapeKeyDown
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle
                    sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#164563',
                    }}
                >
                    Clarify Your Research Scope
                </DialogTitle>
                <DialogContent>
                    <Typography
                        sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '14px',
                            color: '#5B5B5B',
                            lineHeight: 1.5,
                            mb: 2,
                        }}
                    >
                        Answering these helps the agent narrow evidence and improve citation quality.
                    </Typography>

                    {pendingClarification?.reason && (
                        <Box
                            sx={{
                                borderRadius: '10px',
                                backgroundColor: '#F4F8FF',
                                border: '1px solid #D6E6FF',
                                px: 1.5,
                                py: 1,
                                mb: 2,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '13px',
                                    color: '#1C4C8C',
                                    lineHeight: 1.45,
                                }}
                            >
                                {pendingClarification.reason}
                            </Typography>
                        </Box>
                    )}

                    <Stack spacing={2}>
                        {(pendingClarification?.questions || []).map((question, index) => {
                            const questionKey = getClarificationQuestionKey(question, index);
                            const draft = clarificationDrafts[questionKey] || { selected: [], text: '' };
                            const selected = Array.isArray(draft.selected) ? draft.selected : [];
                            const otherText = typeof draft.text === 'string' ? draft.text : '';
                            const responseType = String(question?.response_type || 'text').toLowerCase();
                            const options = Array.isArray(question?.options) ? question.options : [];
                            const radioValue = otherText ? '__other__' : (selected[0] || '');

                            return (
                                <Box
                                    key={questionKey}
                                    sx={{
                                        border: '1px solid #E6EDF8',
                                        borderRadius: '12px',
                                        p: 1.5,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontFamily: 'DM Sans, sans-serif',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: '#6B7A90',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                            mb: 0.5,
                                        }}
                                    >
                                        {question?.header || `Question ${index + 1}`}
                                    </Typography>

                                    <Typography
                                        sx={{
                                            fontFamily: 'DM Sans, sans-serif',
                                            fontSize: '15px',
                                            fontWeight: 500,
                                            color: '#243449',
                                            lineHeight: 1.45,
                                            mb: 1,
                                        }}
                                    >
                                        {question?.question || ''}
                                    </Typography>

                                    {responseType === 'single' && (
                                        <>
                                            <RadioGroup
                                                value={radioValue}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    if (nextValue === '__other__') {
                                                        updateClarificationDraft(questionKey, {
                                                            selected: [],
                                                            text: otherText,
                                                        });
                                                        return;
                                                    }
                                                    updateClarificationDraft(questionKey, {
                                                        selected: nextValue ? [nextValue] : [],
                                                        text: '',
                                                    });
                                                }}
                                            >
                                                {options.map((option) => {
                                                    const optionLabel = String(option?.label || '').trim();
                                                    if (!optionLabel) return null;
                                                    return (
                                                        <FormControlLabel
                                                            key={optionLabel}
                                                            value={optionLabel}
                                                            control={<Radio size="small" />}
                                                            label={option?.description || optionLabel}
                                                        />
                                                    );
                                                })}
                                                <FormControlLabel value="__other__" control={<Radio size="small" />} label="Other" />
                                            </RadioGroup>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Optional custom answer"
                                                value={otherText}
                                                onChange={(event) => {
                                                    updateClarificationDraft(questionKey, {
                                                        selected: [],
                                                        text: event.target.value,
                                                    });
                                                }}
                                                sx={{ mt: 1 }}
                                            />
                                        </>
                                    )}

                                    {responseType === 'multi' && (
                                        <>
                                            <Stack spacing={0.5}>
                                                {options.map((option) => {
                                                    const optionLabel = String(option?.label || '').trim();
                                                    if (!optionLabel) return null;
                                                    const checked = selected.includes(optionLabel);
                                                    return (
                                                        <FormControlLabel
                                                            key={optionLabel}
                                                            control={(
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={checked}
                                                                    onChange={(event) => {
                                                                        const nextSelected = event.target.checked
                                                                            ? [...selected, optionLabel]
                                                                            : selected.filter((item) => item !== optionLabel);
                                                                        updateClarificationDraft(questionKey, {
                                                                            selected: Array.from(new Set(nextSelected)),
                                                                            text: otherText,
                                                                        });
                                                                    }}
                                                                />
                                                            )}
                                                            label={option?.description || optionLabel}
                                                        />
                                                    );
                                                })}
                                            </Stack>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Optional additional context"
                                                value={otherText}
                                                onChange={(event) => {
                                                    updateClarificationDraft(questionKey, {
                                                        selected,
                                                        text: event.target.value,
                                                    });
                                                }}
                                                sx={{ mt: 1 }}
                                            />
                                        </>
                                    )}

                                    {responseType === 'text' && (
                                        <TextField
                                            fullWidth
                                            size="small"
                                            placeholder="Type your answer"
                                            value={otherText}
                                            onChange={(event) => {
                                                updateClarificationDraft(questionKey, {
                                                    selected: [],
                                                    text: event.target.value,
                                                });
                                            }}
                                        />
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>

                    {clarificationError && (
                        <Typography
                            sx={{
                                mt: 2,
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '13px',
                                color: '#B42318',
                            }}
                        >
                            {clarificationError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <MuiButton
                        disabled={clarificationSubmitting}
                        onClick={() => submitClarification({ useDefaults: true })}
                        sx={{
                            borderRadius: '10px',
                            border: '1px solid #CBD5E1',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            color: '#475569',
                        }}
                    >
                        Skip (Use Defaults)
                    </MuiButton>
                    <MuiButton
                        disabled={clarificationSubmitting}
                        onClick={() => submitClarification({ useDefaults: false })}
                        sx={{
                            borderRadius: '10px',
                            border: '1px solid #155DFC',
                            backgroundColor: '#155DFC',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            color: '#FFFFFF',
                            '&:hover': {
                                backgroundColor: '#0E4EDB',
                                borderColor: '#0E4EDB',
                            },
                        }}
                    >
                        {clarificationSubmitting ? 'Submitting...' : 'Submit Answers'}
                    </MuiButton>
                </DialogActions>
            </Dialog>

            <Dialog
                open={showLeaveConfirmDialog}
                onClose={handleLeaveDialogCancel}
                className="api-keys-dialog-root"
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle
                    sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#164563',
                        paddingBottom: '8px',
                    }}
                >
                    Leave this page?
                </DialogTitle>
                <DialogContent
                    sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '14px',
                        color: '#5B5B5B',
                        lineHeight: 1.5,
                        paddingTop: '4px !important',
                    }}
                >
                    Leaving this page will interrupt the current LLM response loading.
                </DialogContent>
                <DialogActions sx={{ padding: '16px 24px 24px' }}>
                    <MuiButton
                        onClick={handleLeaveDialogCancel}
                        sx={{
                            borderRadius: '12px',
                            border: '1px solid #D6DDE8',
                            color: '#164563',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 700,
                            fontSize: '14px',
                            padding: '8px 16px',
                        }}
                    >
                        Stay
                    </MuiButton>
                    <MuiButton
                        onClick={handleLeaveDialogConfirm}
                        sx={{
                            borderRadius: '12px',
                            border: '1px solid #DC2626',
                            backgroundColor: '#DC2626',
                            color: '#ffffff',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 700,
                            fontSize: '14px',
                            padding: '8px 16px',
                            '&:hover': {
                                backgroundColor: '#B91C1C',
                                borderColor: '#B91C1C',
                            },
                        }}
                    >
                        Leave
                    </MuiButton>
                </DialogActions>
            </Dialog>

            <Dialog
                open={feedbackOpen}
                onClose={handleCloseFeedback}
                fullWidth
                maxWidth={false}
                PaperProps={{
                    sx: {
                        width: '100%',
                        maxWidth: '512px',
                        borderRadius: '16px',
                        boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                <Box sx={{ p: '40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                            sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '24px',
                                fontWeight: '700 !important',
                                lineHeight: 1.3,
                                color: '#333333',
                            }}
                        >
                            Share your feedback
                        </Typography>
                        <IconButton onClick={handleCloseFeedback} aria-label="Close feedback dialog">
                            <ClearIcon sx={{ color: '#646464' }} />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Typography
                            sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '16px',
                                fontWeight: '400 !important',
                                lineHeight: 1.5,
                                color: '#323232',
                            }}
                        >
                            Your feedback helps us improve GLKB.
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <IconButton
                                    key={star}
                                    onClick={() => setFeedbackRating(star)}
                                    sx={{ p: 0, width: '40px', height: '40px' }}
                                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                >
                                    <StarIcon
                                        sx={{
                                            fontSize: 32,
                                            color: feedbackRating >= star ? '#F5AF18' : '#D8D8D8',
                                        }}
                                    />
                                </IconButton>
                            ))}
                        </Box>

                        <TextField
                            multiline
                            minRows={4}
                            value={feedbackText}
                            onChange={(event) => setFeedbackText(event.target.value)}
                            placeholder="What did you think of this response?  (optional)"
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '16px',
                                    fontWeight: '400 !important',
                                    color: '#323232',
                                    '& fieldset': {
                                        borderColor: '#969696',
                                    },
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: '#969696',
                                    opacity: 1,
                                },
                            }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '28px' }}>
                        <MuiButton
                            onClick={handleCloseFeedback}
                            sx={{
                                borderRadius: '8px',
                                border: '1px solid #D8D8D8',
                                color: '#323232',
                                backgroundColor: '#FFFFFF',
                                textTransform: 'none',
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '16px',
                                fontWeight: '400 !important',
                                lineHeight: 1.3,
                                px: '16px',
                                py: '8px',
                                minWidth: '96px',
                            }}
                        >
                            Cancel
                        </MuiButton>
                        <MuiButton
                            onClick={handleSubmitFeedback}
                            disabled={feedbackSubmitting || feedbackRating < 1}
                            sx={{
                                borderRadius: '8px',
                                backgroundColor: '#155DFC',
                                color: '#FFFFFF',
                                textTransform: 'none',
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '16px',
                                fontWeight: '400 !important',
                                lineHeight: 1.3,
                                px: '16px',
                                py: '8px',
                                minWidth: '170px',
                                '&:hover': {
                                    backgroundColor: '#0E4EDB',
                                },
                                '&.Mui-disabled': {
                                    backgroundColor: '#9EBEFF',
                                    color: '#FFFFFF',
                                },
                            }}
                        >
                            {feedbackSubmitting ? 'Submitting...' : 'Submit feedback'}
                        </MuiButton>
                    </Box>
                </Box>
            </Dialog>

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
                                            <Box className="llm-column" sx={{ flex: useMobileReferencesDrawer ? '1 1 auto' : `0 0 ${leftPaneWidth}%`, minWidth: useMobileReferencesDrawer ? 0 : `${LEFT_MIN_PX}px` }}>
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
                                                            <Typography
                                                                component="button"
                                                                type="button"
                                                                onClick={() => navigate('/')}
                                                                aria-label="Go to home"
                                                                sx={{
                                                                    fontFamily: 'DM Sans, sans-serif',
                                                                    fontSize: '16px',
                                                                    fontWeight: 500,
                                                                    color: '#164563',
                                                                    textDecoration: 'underline',
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    padding: 0,
                                                                    cursor: 'pointer',
                                                                    whiteSpace: 'nowrap',
                                                                    flexShrink: 0,
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
                                                            {isEditingChatTitle ? (
                                                                <TextField
                                                                    value={chatTitleDraft}
                                                                    onChange={(event) => setChatTitleDraft(event.target.value)}
                                                                    size="small"
                                                                    autoFocus
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') {
                                                                            event.preventDefault();
                                                                            handleConfirmChatTitleEdit();
                                                                        }
                                                                        if (event.key === 'Escape') {
                                                                            event.preventDefault();
                                                                            handleCancelChatTitleEdit();
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        maxWidth: '280px',
                                                                        '& .MuiInputBase-root': {
                                                                            fontFamily: 'DM Sans, sans-serif',
                                                                            fontSize: '14px',
                                                                            fontWeight: 500,
                                                                            color: '#164563',
                                                                        },
                                                                    }}
                                                                />
                                                            ) : (
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
                                                            )}
                                                            <IconButton
                                                                size="small"
                                                                onClick={isEditingChatTitle ? handleConfirmChatTitleEdit : handleEditChatTitle}
                                                                disabled={
                                                                    authLoading
                                                                    || !isAuthenticated
                                                                    || (!activeConversationIdRef.current && !activeConversationId)
                                                                }
                                                                sx={{
                                                                    padding: '4px',
                                                                    color: isEditingChatTitle ? '#2c5cf3' : '#8A8A8A',
                                                                    '&:hover': {
                                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                                    },
                                                                }}
                                                                title={isEditingChatTitle ? 'Save chat title' : 'Edit chat title'}
                                                            >
                                                                {isEditingChatTitle ? (
                                                                    <CheckIcon sx={{ fontSize: 18 }} />
                                                                ) : (
                                                                    <EditNoteIcon sx={{ fontSize: 18 }} />
                                                                )}
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={handleToggleConversationBookmark}
                                                                disabled={
                                                                    authLoading
                                                                    || !isAuthenticated
                                                                    || (!activeConversationIdRef.current && !activeConversationId)
                                                                }
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
                                                            display: useMobileReferencesDrawer ? 'none' : 'inline-flex',
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
                                                        <MuiButton
                                                            variant='outlined'
                                                            value={userInput}
                                                            onChange={(e) => setUserInput(e.target.value)}
                                                            placeholder="Ask a question about the biomedical literature..."
                                                            className="message-input"
                                                            disabled={isLoading}
                                                        />
                                                        <button
                                                            type="submit"
                                                            className="send-button"
                                                                border: "1px solid #155DFC",
                                                                bgcolor: "#f7f8fa",
                                                                color: "#155DFC",
                                                                "& .MuiButton-startIcon": {
                                                                    color: "#155DFC",
                                                                },
                                                                "& .MuiSvgIcon-root": {
                                                                    color: "#155DFC",
                                                                },
                                                        >
                                                            Send
                                                                    color: "#155DFC",
                                                                    boxShadow: index == selectedMessageIndex ? "0 0 0 1px #155DFC" : "none",
                                                            icon={<DeleteOutlined />}
                                                                boxShadow: index == selectedMessageIndex ? "0 0 0 1px #155DFC" : "none",
                                                            className="clear-button"
                                                            disabled={isLoading}
                                                        >
                                                            Clear History
                                                        </Button>
                                                    </form>
                                                </div> */}
                                                    {showLimitWarning && (
                                                        <div className="llm-limit-warning">
                                                            <span className="llm-limit-warning-text">
                                                                You've reached your query limit ({displayedQueryLimit} queries). Upgrade for unlimited access.
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="llm-limit-warning-button"
                                                                disabled
                                                            >
                                                                Update
                                                            </button>
                                                        </div>
                                                    )}
                                                    <ChatSearchBar
                                                        userInput={userInput}
                                                        setUserInput={setUserInput}
                                                        isLoading={isLoading}
                                                        isQueryLimitReached={isLimitReachedEffective}
                                                        onSubmit={handleSubmit}
                                                        onStop={handleStopStreaming}
                                                    />
                                                </div>
                                            </Box>
                                            {!useMobileReferencesDrawer && !isReferencesCollapsed && (
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
                                                                                <div
                                                                                    key={index}
                                                                                    data-pubmed-id={pubmedId}
                                                                                    className={`reference-entry-wrapper${isHighlighted ? ' highlighted' : ''}`}
                                                                                    onClick={(event) => handleReferenceEntryContainerClick(event, url[1])}
                                                                                >
                                                                                    <ReferenceCard
                                                                                        url={url}
                                                                                        evidence={ref.evidence}
                                                                                        sourceHid={activeConversationIdRef.current || activeConversationId}
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
                                        {!useMobileReferencesDrawer && isReferencesCollapsed && (
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

                                        {useMobileReferencesDrawer && (
                                            <Drawer
                                                anchor="bottom"
                                                open={isMobileReferencesDrawerOpen}
                                                onClose={() => setIsMobileReferencesDrawerOpen(false)}
                                                PaperProps={{ className: 'llm-mobile-references-drawer' }}
                                            >
                                                <div className="references-container llm-mobile-references-container">
                                                    <div style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        height: '70px',
                                                        borderBottom: '1px solid #E6E6E6',
                                                        marginBottom: '1px',
                                                    }}>
                                                        <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '16px', color: '#164563', marginBottom: '0', paddingLeft: '20px' }}>References</h3>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '10px' }}>
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
                                                                onClick={() => setIsMobileReferencesDrawerOpen(false)}
                                                                title="Close references"
                                                            >
                                                                <ChevronRightIcon sx={{ color: '#164563', transform: 'rotate(90deg)' }} />
                                                            </IconButton>
                                                        </div>
                                                    </div>

                                                    {sortedReferences.length > 0 ? (
                                                        <div ref={referencesListRef} className="references-list" style={{ maxHeight: 'calc(100% - 70px)', overflowY: 'auto', paddingLeft: '1rem', paddingRight: '1rem' }}>
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
                                                                    <div
                                                                        key={index}
                                                                        data-pubmed-id={pubmedId}
                                                                        className={`reference-entry-wrapper${isHighlighted ? ' highlighted' : ''}`}
                                                                        onClick={(event) => handleReferenceEntryContainerClick(event, url[1])}
                                                                    >
                                                                        <ReferenceCard
                                                                            url={url}
                                                                            evidence={ref.evidence}
                                                                            sourceHid={activeConversationIdRef.current || activeConversationId}
                                                                            handleClick={handleClick}
                                                                            onCiteClick={handleCiteClick}
                                                                            isHighlighted={isHighlighted}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p style={{ padding: '16px 20px' }}>No references available for this response.</p>
                                                    )}
                                                </div>
                                            </Drawer>
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
