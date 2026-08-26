import './scoped.css';
// import github.css
import './github-markdown-light.css';

import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { message } from 'antd';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import {
  Navigate,
  UNSAFE_NavigationContext,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import {
  ArrowForward as ArrowForwardIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  EditNote as EditNoteIcon,
  ExpandMore as ExpandMoreIcon,
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

import { emptyFunnel, mergeFunnel } from './funnel';
import InvestigateProgress, { formatElapsed } from './InvestigateProgress';
import ClarifyPanel, { getClarificationQuestionKey } from './ClarifyPanel';
import ReferenceHoverCard from './ReferenceHoverCard';
import { getBookmarks, toggleBookmark } from '../../utils/bookmarks';
import { resolveClarifyRound } from './clarifyRound';
import { mintSessionId } from './sessionId';
import { makeDrip } from './streamDrip';
import { ReactComponent as ContentCopyIcon } from '../../img/llm/content_copy.svg';
import { ReactComponent as DownloadIcon } from '../../img/llm/download_2.svg';
import { ReactComponent as ReferenceIcon } from '../../img/llm/reference.svg';
import { ReactComponent as ReplayIcon } from '../../img/llm/replay.svg';
import { ReactComponent as ThumbsUpDownIcon } from '../../img/llm/thumbs_up_down.svg';
import { submitChatFeedback } from '../../service/Feedback';
import {
  INVESTIGATE_PHASE_ORDER,
  LLMAgentService,
  PHASE_PERCENT_FLOOR,
  inferInvestigatePhase,
} from '../../service/LLMAgent';
import { getCurrentUser } from '../../service/Auth';
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
import {
    NOTIFY_EMAIL_KEY,
    getNotifyPrefs,
    getUserNotifyEmail,
    notifyRunComplete,
    setNotifyPref,
    subscribeToNotifyPrefs,
} from '../../service/notifications';
import { clearActiveRun, setActiveRun } from '../../service/activeRun';
import { isInvestigateConversation, markInvestigateConversation } from '../../utils/investigateConversations';
import { isExchangeUnfinished } from '../../service/resumeRun';
import {
    bindMarkersToLinks,
    citationsFor,
    hrefWithoutMarker,
    indexByMarker,
    markerFromHref,
    parseDirectCitations,
    pmidFromHref,
    stripCitationsBlock,
} from '../../utils/directCitations';
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

/**
 * The "Investigated for m:ss" row shown once the run closes.
 *
 * Formatting is delegated to the live header clock's `formatElapsed` so the two can never drift
 * apart — same shape, same truncation, same `Date.now()` origin. Returns '' for an unknown
 * duration, which is also what gates the row's visibility.
 */
const formatInvestigatedDuration = (durationMs) => {
    if (durationMs === null || durationMs === undefined) return '';
    return formatElapsed(durationMs / 1000);
};

const mergeLiveKeywords = (prev, next) => {
    if (!Array.isArray(next) || !next.length) return prev || [];
    return Array.from(new Set([...(prev || []), ...next.map(String)]));
};

const mergeLivePapers = (prev, next) => {
    if (!Array.isArray(next) || !next.length) return prev || [];
    const map = new Map();
    [...(prev || []), ...next].forEach((paper) => {
        if (!paper) return;
        const key = paper.pmid || paper.id || paper.title;
        if (!key) return;
        map.set(String(key), paper);
    });
    return Array.from(map.values());
};

/**
 * Fold one progress frame's structured fields into the accumulated detail. Kept additive: a
 * frame that omits `facets` must not blank the facets the analyzing step is displaying, and the
 * writing frames only carry section/step/total. Keys are renamed to the shapes the panel reads.
 */
const mergeInvestigateDetail = (prev, next, label) => {
    const out = { ...(prev || {}) };
    if (Array.isArray(next.topic) && next.topic.length) out.topic = next.topic.map(String);
    if (Array.isArray(next.facets) && next.facets.length) out.facets = next.facets.map(String);
    // Retrieval channels reporting one by one. Accumulated (not replaced) and de-duplicated by
    // name, because each frame carries the running list and a later frame must not drop an
    // earlier probe's result.
    if (Array.isArray(next.channels) && next.channels.length) {
        const byName = new Map((out.channels || []).map((c) => [c.name, c]));
        next.channels.forEach((c) => {
            if (!c || !c.name) return;
            // `pending` = announced but still running. Carried through so the panel can say
            // "searching…" instead of showing an unfinished probe as a failure.
            byName.set(String(c.name), {
                name: String(c.name),
                hits: Number(c.hits) || 0,
                ok: c.ok !== false,
                pending: c.pending === true,
            });
        });
        out.channels = Array.from(byName.values());
    }
    // `facets` is capped for display; `n_facets` is the true count.
    if (Number.isFinite(Number(next.n_facets))) out.nFacets = Number(next.n_facets);
    if (Number.isFinite(Number(next.n_claims))) out.nClaims = Number(next.n_claims);
    if (Number.isFinite(Number(next.n_conflicted))) out.nConflicted = Number(next.n_conflicted);
    // `step`/`total` only mean "report section i of n" on the writing frames — the reading frame
    // also carries a `total` (the paper count), which must not be read as a section count.
    if (next.section) {
        out.section = String(next.section);
        if (Number.isFinite(Number(next.step))) out.step = Number(next.step);
        if (Number.isFinite(Number(next.total))) out.totalSections = Number(next.total);
    }
    if (label) out.label = String(label);
    return out;
};

/**
 * Phases only ever move forward. A frame that names an earlier phase — a late-arriving event, a
 * phase inferred from free text, or a stage that reports its own completion — must not rewind the
 * header from "Reading..." back to "Searching...". Unknown phases are ignored rather than
 * treated as a reset.
 */
const mergePhaseMonotonic = (prev, next) => {
    if (!next) return prev;
    if (!prev) return next;
    const a = INVESTIGATE_PHASE_ORDER.indexOf(prev);
    const b = INVESTIGATE_PHASE_ORDER.indexOf(next);
    if (b < 0) return prev;
    if (a < 0) return next;
    return b >= a ? next : prev;
};

const mergePercentMonotonic = (prev, next) => {
    if (!Number.isFinite(Number(next))) return prev;
    const n = Math.max(0, Math.min(100, Math.round(Number(next))));
    if (!Number.isFinite(Number(prev))) return n;
    return Math.max(Number(prev), n);
};

const formatFunnelValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString();
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
            otherSelected: false,
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

// Reattaching to a run left behind by a reload. An investigate run can take fifteen minutes, so
// the cap is generous on purpose: giving up early is the expensive mistake here — it turns an
// answer that is still coming into a message that says it is gone.
const RESUME_POLL_MS = 3000;
const RESUME_MAX_POLLS = 300;      // 15 minutes
const RESUME_LOST_MESSAGE =
    'This answer could not be recovered after the page was reloaded. Please ask again.';
const PUBMED_ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PLACEHOLDER_PMID_PREFIX = 'PMID ';

const LEFT_MIN_PX = 360;
const RIGHT_MIN_PX = 360;
const DIVIDER_PX = 8;
const PREFERRED_CHAT_COLUMN_MIN_PX = 680;
const MIN_SPLIT_WIDTH_WITH_REFERENCES = PREFERRED_CHAT_COLUMN_MIN_PX + DIVIDER_PX + RIGHT_MIN_PX;
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

const AGENT_STEP_LABEL = (action) => {
    if (action === 'AGENT START' || action === 'AGENT INPUT') {
        return STEP_LABELS.GLKBAgent || 'Agent is thinking';
    }
    if (action === 'AGENT OUTPUT') {
        return STEP_LABELS.FinalAnswerAgent || 'Formulating the final answer';
    }
    return '';
};

// Anything that still carries a JSON payload or a pipe is a raw transport trace
// rather than something worth showing a user.
const looksLikeRawPayload = (value) => /[{}]|\bInput:|\bOutput:|\|/.test(String(value));

const getStepLabel = (stepName) => {
    if (!stepName) return '';
    if (STEP_LABELS[stepName]) return STEP_LABELS[stepName];

    // Raw traces ("[TOOL CALL] search_pubmed | Input: {…}") reach this function
    // directly from progress frames, which bypass parseThinkingEntry. Only the
    // token right after the bracket carries meaning; the payload is never shown.
    const bracketMatch = String(stepName).match(/^\s*\[([^\]]+)\]\s*([\s\S]*)$/);
    if (bracketMatch) {
        const action = bracketMatch[1].trim().toUpperCase();
        const token = bracketMatch[2].split('|')[0].trim();
        if (token && STEP_LABELS[token]) return STEP_LABELS[token];
        const agentLabel = AGENT_STEP_LABEL(action);
        if (agentLabel) return agentLabel;
        if (token && !looksLikeRawPayload(token)) return token.replace(/_/g, ' ');
        return STEP_LABELS[bracketMatch[1].trim()] || STEP_LABELS.Processing || 'Working...';
    }

    const toolMatch = String(stepName).match(/^TOOL\s+(?:CALL|RESULT):\s*(.+)$/i);
    if (toolMatch?.[1]) {
        const toolName = toolMatch[1].split('|')[0].trim();
        return STEP_LABELS[toolName] || toolName.replace(/_/g, ' ');
    }

    const agentLabel = AGENT_STEP_LABEL(String(stepName).toUpperCase());
    if (agentLabel) return agentLabel;

    // Never let an unmapped payload string become the visible step wording.
    if (looksLikeRawPayload(stepName)) {
        return STEP_LABELS.Processing || 'Working...';
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
                            /* body-sm. This is what a step did, not what the answer says, and
                               it was set at 16 — larger than the answer's own 14, and larger
                               than the 12 the streaming lines beside it use. The rest of the
                               app left DM Sans behind too. */
                            fontFamily: 'Geist, sans-serif',
                            fontSize: '12px',
                            fontWeight: 400,
                            color: 'var(--color-text-tertiary)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '20px',
                        }}
                    >
                        {tool && (
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: 'Geist, sans-serif',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: 'var(--color-text-tertiary)',
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
                            fontFamily: 'Geist, sans-serif',
                            fontSize: '12px',
                            fontWeight: 400,
                            color: 'var(--color-text-tertiary)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '20px',
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
                fontFamily: 'Geist, sans-serif',
                fontSize: '12px',
                fontWeight: 400,
                lineHeight: '20px',
                color: 'var(--color-grey-400)',
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
                        color: 'var(--color-text-tertiary)',
                    }}>
                        {getStepLabel(group.name)}
                    </Typography>
                    {canToggle && (
                        <ExpandMoreIcon
                            className="thought-step-arrow"
                            sx={{
                                fontSize: '16px',
                                color: 'var(--color-grey-400)',
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
                        borderLeft: showBorder ? '2px solid var(--color-border-strong)' : 'none',
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
    // A run of text the model streamed before a tool call — its own narration on the way to
    // the next step, not the answer. There is no transport tag to parse: the content IS the
    // line, and the heading is fixed so consecutive narrations collapse into one group.
    if (entry?.isThought) {
        return { stepName: 'Thinking', line: raw };
    }
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

    // Resolve to the human-facing wording from step.json. Grouping keys off this
    // value, so "[TOOL CALL] search_pubmed" and its matching "[TOOL RESULT]"
    // collapse into a single "Searching for relevant articles".
    //
    // The tool/agent name must win over `stepFromEntry`: the transport tags
    // nearly every frame as "Processing", which would otherwise flatten every
    // distinct tool into the generic "Working...".
    const derivedLabel = derivedStepName ? getStepLabel(derivedStepName) : '';
    const hasSpecificLabel = Boolean(derivedLabel) && derivedLabel !== derivedStepName;

    if (hasSpecificLabel) {
        stepName = derivedLabel;
    } else if (stepFromEntry && STEP_LABELS[stepFromEntry] && !isGenericTransportStep) {
        stepName = STEP_LABELS[stepFromEntry];
    } else if (derivedStepName) {
        stepName = derivedLabel || derivedStepName;
    } else if (stepFromEntry) {
        stepName = getStepLabel(stepFromEntry) || stepFromEntry;
    } else {
        stepName = 'Step';
    }

    // `[TOOL CALL] … | Input: {…}` / `[AGENT START] …` are internal debug traces.
    // Users see only the mapped wording, never the raw payload.
    const isInternalTrace = Boolean(action);

    return { stepName, line: isInternalTrace ? '' : raw };
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

/**
 * References placeholder shown while a run is streaming (MOTION-SPEC §7).
 *
 * A highlight wave travels top-to-bottom on a loop — at any instant one card group is at full
 * opacity and the rest are near-invisible. This is deliberately a shimmer and NOT progressive
 * loading: references only exist once the run completes, so an appearance of cards filling in
 * would be a lie about what the panel knows.
 */
const REFERENCE_SKELETON_CARDS = 6;
// Figma 44:4744 draws five bars per card; their widths are set positionally in scoped.css so the
// markup stays a plain list and the design's 80/232/200/180/160 ladder lives in one place.
const REFERENCE_SKELETON_BARS = 5;

const ReferencesSkeleton = () => (
    <div className="references-list ref-skeleton" aria-hidden="true">
        {Array.from({ length: REFERENCE_SKELETON_CARDS }).map((_, i) => (
            <div
                className="ref-skeleton-card"
                key={`ref-skeleton-${i}`}
                style={{ animationDelay: `${(i * 1.6) / REFERENCE_SKELETON_CARDS}s` }}
            >
                {Array.from({ length: REFERENCE_SKELETON_BARS }).map((__, j) => (
                    <span className="ref-skeleton-bar" key={`ref-skeleton-${i}-${j}`} />
                ))}
            </div>
        ))}
    </div>
);

// The agent occasionally emits raw citation placeholders (`[[c1]]`, `[[c1, c2]]`)
// that were never resolved into links. They carry no meaning for the reader, so
// they are stripped rather than shown as literal text next to the real badges.
const UNRESOLVED_CITATION_TOKEN = /\[\[\s*c\d+(?:\s*,\s*c\d+)*\s*\]\]/gi;

const stripUnresolvedCitations = (content) => {
    if (typeof content !== 'string' || !content.includes('[[')) return content;
    return content.replace(UNRESOLVED_CITATION_TOKEN, '');
};

// The tail of a streamed answer is a sentence caught mid-word, and markdown does not degrade
// gracefully when you cut it there: half of `[38743124](https://…` renders as literal text, and
// `## Citation` renders as a heading that vanishes a chunk later. Both flicker, and neither is in
// the finished answer. They are removed while the text is still arriving and left alone once it
// is final, so what the reader sees only ever grows.
const PARTIAL_CITATIONS_HEADING = /\n+#{1,6}[ \t]*c(i(t(a(t(i(o(n(s)?)?)?)?)?)?)?)?[ \t]*$/i;
const UNCLOSED_LINK = /\[[^\]\n]*\][ \t]*\([^)\n]*$/;
const UNCLOSED_BRACKET = /\[[^\]\n]*$/;

const tidyStreamingText = (content) => {
    if (typeof content !== 'string' || !content) return content;
    return content
        .replace(PARTIAL_CITATIONS_HEADING, '')
        .replace(UNCLOSED_LINK, '')
        .replace(UNCLOSED_BRACKET, '');
};

const rafSchedule = (fn) => (
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 33)
);
const rafCancel = (id) => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
};

/**
 * A callback whose identity never changes but which always calls the latest closure.
 *
 * `MessageCard` is memoised, and six of the handlers it takes were re-created on every
 * render — which defeated the memo for EVERY card, so a single streamed chunk re-parsed
 * the markdown of every answer in the conversation, not just the one being written.
 */
const useStableCallback = (fn) => {
    const ref = useRef(fn);
    useLayoutEffect(() => { ref.current = fn; });
    return useCallback((...args) => ref.current?.(...args), []);
};

// Stable placeholders for the live-run props, which only the streaming card ever reads
// (every use inside MessageCard is behind `isLoading`). Passing the live values to the
// settled cards as well changed their props on every frame and re-rendered them for nothing.
// How far from the bottom the reader may be before auto-follow stops chasing them.
const AUTO_FOLLOW_SLACK_PX = 80;
// The conversation is mirrored into sessionStorage for a reload mid-answer; it does not need
// to be written once per streamed chunk.
const CHAT_PERSIST_DEBOUNCE_MS = 400;

const NO_GROUPS = [];
const NO_KEYWORDS = [];
const NO_PAPERS = [];
const NO_DETAIL = {};

const MessageCard = React.memo(function MessageCard({
    index,
    message,
    totalMessages,
    isProcessing,
    streamingGroups,
    streamingStepName,
    preamble,
    investigatePhase,
    investigateFunnel,
    investigateStartedAt,
    investigatePercent,
    investigateKeywords,
    investigatePapers,
    investigateDetail,
    pendingClarification,
    clarificationDrafts,
    clarificationError,
    clarificationSubmitting,
    hasInvalidOtherSelection,
    onUpdateClarificationDraft,
    onSubmitClarification,
    onSkipClarification,
    showReloadPrompt,
    onReloadLatest,
    onStop,
    refresh,
    copy,
    save,
    downloadConversation,
    onOpenFeedback,
}) {
    const isAssistant = message.role === "assistant";
    const isLastUserMessage = index === totalMessages - 1 && message.role === 'assistant';
    const isLoading = isProcessing && isLastUserMessage;
    const messageID = index;
    /* Each chip is bound to one passage, so a paper cited twice for two different sentences
       shows two different quotes. The binding rides on the link as a `#cN` fragment — see
       utils/directCitations — which is why every read of a citation href goes through
       pmidFromHref rather than splitting on '/'. */
    const directCitations = useMemo(
        () => citationsFor(message.directCitations, message.content),
        [message.directCitations, message.content],
    );
    const citationsByMarker = useMemo(() => indexByMarker(directCitations), [directCitations]);

    // While the answer is still streaming there are no `references` yet, so every citation fell
    // through to its raw PMID and then snapped to a small number when the Complete frame landed —
    // the most visible way the streamed text differed from the finished one. The backend numbers
    // references by order of first appearance in the answer, so reading that same order off the
    // text already on screen gives each citation the number it is about to be given.
    // (With an active `ranking_mode` the backend reranks afterwards, so a number can still change
    // once — a far smaller change than an eight-digit PMID becoming a 1.)
    const streamingNumberByPmid = useMemo(() => {
        if ((message.references || []).length) return null;
        const order = new Map();
        const text = String(message.content || '');
        for (const match of text.matchAll(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/g)) {
            if (!order.has(match[1])) order.set(match[1], order.size + 1);
        }
        return order;
    }, [message.references, message.content]);

    const getReferenceNumber = (href) => {
        const pmid = pmidFromHref(href);
        const referenceIndex = (message.references || []).findIndex(
            (reference) => extractPmidFromReference(reference) === pmid
        );
        if (referenceIndex >= 0) return referenceIndex + 1;
        return streamingNumberByPmid?.get(pmid) ?? null;
    };
    const allowUserEdit = true;

    /**
     * Reference hover card (Figma "Reference - Hover Preview"). Replaces the browser's native
     * `title` tooltip on a citation, which could only show one unstyled string and never said
     * which paper the quote came from.
     *
     * The close is delayed because the card is a hover target itself — Full Text and the bookmark
     * are only reachable if moving the pointer off the citation and onto the card does not dismiss
     * it on the way across the gap.
     */
    const [hoverCard, setHoverCard] = useState(null);
    const [bookmarkedPmids, setBookmarkedPmids] = useState(() => new Set());
    const hoverCloseTimer = useRef(null);

    const cancelHoverClose = () => {
        if (hoverCloseTimer.current) {
            clearTimeout(hoverCloseTimer.current);
            hoverCloseTimer.current = null;
        }
    };

    const showReferenceCard = (href, element) => {
        cancelHoverClose();
        const pmid = pmidFromHref(href);
        const reference = (message.references || []).find(
            (item) => extractPmidFromReference(item) === pmid,
        );
        if (!reference || !element) return;
        setHoverCard({
            reference,
            number: getReferenceNumber(href),
            rect: element.getBoundingClientRect(),
            // The passage this particular chip rests on, when the answer bound one.
            // Without it the card falls back to the reference's own evidence, which is
            // the same blob for every chip that cites the paper.
            citation: citationsByMarker.get(markerFromHref(href)) || null,
        });
    };

    const hideReferenceCard = () => {
        cancelHoverClose();
        hoverCloseTimer.current = setTimeout(() => setHoverCard(null), 160);
    };

    useEffect(() => () => cancelHoverClose(), []);

    useEffect(() => {
        const sync = (event) => {
            const list = event?.detail || getBookmarks();
            setBookmarkedPmids(new Set(
                (Array.isArray(list) ? list : []).map((item) => String(item.id ?? item.pmid ?? '')),
            ));
        };
        sync();
        window.addEventListener('glkb-bookmarks-updated', sync);
        return () => window.removeEventListener('glkb-bookmarks-updated', sync);
    }, []);

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
    // Once an investigation finishes its thinking collapses into this eyebrow —
    // it should never vanish outright, so a missing duration still renders the row
    // as long as there are thoughts behind it.
    const showInvestigateSummary = isAssistant && isInvestigateMessage && !isLoading
        && (Boolean(investigatedDurationLabel) || hasDisplayGroups);
    const showThoughtHeader = isAssistant && (
        !isInvestigateMessage && (isLoading || thoughtDurationLabel || hasDisplayGroups)
    );
    const showReloadInMessage = showReloadPrompt && isLastUserMessage && isAssistant && !isLoading;
    const canToggleThoughts = !isLoading && hasDisplayGroups;
    const investigateStageLabels = ['Retrieved', 'Screened', 'Extracted', 'Cited'];
    const resolvedPhase = useMemo(() => {
        if (!isInvestigateMessage) return null;
        if (isLoading) {
            // 'planning' is the pre-retrieval floor: the panel mounts at submit, before any frame
            // has arrived, and must not claim to be searching yet.
            return investigatePhase
                || inferInvestigatePhase(streamingStepName, '')
                || 'planning';
        }
        return message.investigatePhase || 'verifying';
    }, [isInvestigateMessage, isLoading, investigatePhase, streamingStepName, message.investigatePhase]);

    const resolvedFunnel = useMemo(() => {
        const fromMessage = message.investigateFunnel || null;
        if (!isLoading) return fromMessage || emptyFunnel();
        // Structured fields only. This used to also regex-scrape numbers out of the raw tool-log
        // lines and let THOSE win, which is how Retrieved could jump to 9,000 and then fall back
        // to 3,000: any stray figure in a tool result that happened to sit near the word
        // "retrieved" overwrote the agent's real count, and the merge was last-write-wins rather
        // than monotonic. The agent now reports every funnel number on every phase, so the
        // scraper has nothing to add and plenty to break.
        return investigateFunnel || emptyFunnel();
    }, [isLoading, message.investigateFunnel, investigateFunnel]);

    // Figma: real % bar when agent sends percent; else phase floor (monotonic)
    // After complete: prefer message.investigatePercent (persisted on final)
    const displayPercent = useMemo(() => {
        const live = Number.isFinite(Number(investigatePercent))
            ? Math.max(0, Math.min(100, Math.round(Number(investigatePercent))))
            : null;
        const saved = Number.isFinite(Number(message.investigatePercent))
            ? Math.max(0, Math.min(100, Math.round(Number(message.investigatePercent))))
            : null;
        if (showInvestigateProgress) {
            if (live != null) return live;
            return PHASE_PERCENT_FLOOR[resolvedPhase] ?? 8;
        }
        // completed card: show 100 if we have funnel/phase saved
        if (showInvestigateSummary) return saved ?? (isInvestigateMessage ? 100 : null);
        return null;
    }, [
        showInvestigateProgress,
        showInvestigateSummary,
        investigatePercent,
        message.investigatePercent,
        resolvedPhase,
        isInvestigateMessage,
    ]);

    const resolvedKeywords = useMemo(() => {
        if (isLoading && Array.isArray(investigateKeywords) && investigateKeywords.length) {
            return investigateKeywords;
        }
        if (Array.isArray(message.investigateKeywords) && message.investigateKeywords.length) {
            return message.investigateKeywords;
        }
        return Array.isArray(investigateKeywords) ? investigateKeywords : [];
    }, [isLoading, investigateKeywords, message.investigateKeywords]);

    const resolvedPapers = useMemo(() => {
        if (isLoading && Array.isArray(investigatePapers) && investigatePapers.length) {
            return investigatePapers;
        }
        if (Array.isArray(message.investigatePapers) && message.investigatePapers.length) {
            return message.investigatePapers;
        }
        return Array.isArray(investigatePapers) ? investigatePapers : [];
    }, [isLoading, investigatePapers, message.investigatePapers]);

    // Tool call step icons — maps tool names and phase labels to MUI icons (per Figma)
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
                        bgcolor: isAssistant ? "transparent" : "var(--color-background-muted)",
                        boxShadow: "none",
                        /* 45:1176/1177 — the question is a background/muted bubble at radius/2,
                           8 by 16, holding body-lg, and its text is capped at 560 rather than at
                           a fraction of the column. 80% of a wide column is a very long line to
                           read; 560 is the measure the frame sets. */
                        maxWidth: isAssistant ? "100%" : "560px",
                        width: isAssistant ? "100%" : "auto",
                        display: "flex",
                        alignItems: "flex-start",
                        px: isAssistant ? "0px" : "16px",
                        pt: isAssistant ? "12px" : "8px",
                        pb: isAssistant ? "24px" : "8px",
                        borderColor: "divider",
                        borderRadius: isAssistant ? "24px" : "var(--radius-2, 8px)",
                        ...(isAssistant ? {} : {
                            fontSize: "16px",
                            fontWeight: 400,
                            lineHeight: "26px",
                            color: "var(--color-text-secondary)",
                        }),
                        // The assistant fills the column; the user bubble hugs its
                        // text, so a one-line question is a one-line-wide box.
                        flex: isAssistant ? 1 : "0 1 auto",
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
                                <span className="investigate-summary-text">
                                    {investigatedDurationLabel ? `Investigated for ${investigatedDurationLabel}` : 'Investigation details'}
                                </span>
                                {canToggleThoughts && (
                                    <ChevronRightIcon className={`investigate-summary-chevron${thoughtsExpanded ? ' expanded' : ''}`} />
                                )}
                            </Box>
                        )}
                        {showInvestigateSummary && (resolvedFunnel?.retrieved != null || resolvedFunnel?.cited != null) && (
                            <Box className="investigate-funnel-summary" aria-label="Investigation funnel">
                                {investigateStageLabels.map((label) => {
                                    const key = label.toLowerCase();
                                    return (
                                        <span key={label} className="investigate-funnel-chip">
                                            <strong>{formatFunnelValue(resolvedFunnel?.[key])}</strong> {label}
                                        </span>
                                    );
                                })}
                            </Box>
                        )}

                        {showInvestigateProgress && (
                            <InvestigateProgress
                                phase={resolvedPhase}
                                funnel={resolvedFunnel}
                                percent={displayPercent}
                                keywords={resolvedKeywords}
                                papers={resolvedPapers}
                                detail={investigateDetail}
                                label={investigateDetail?.label || streamingStepName || ''}
                                /* Same `Date.now()` the final "Investigated for m:ss" is measured
                                   from, so the live clock and the summary row cannot disagree. */
                                startedAt={investigateStartedAt}
                                /* The agent's `summary` frame lands just before the report itself,
                                   so this is the brief terminal beat: bar at 100%, clock freezes,
                                   title becomes "Report ready" — then the panel gives way to the
                                   "Investigated for m:ss" summary row when the run closes. */
                                done={resolvedPhase === 'summary'}
                                expanded={investigateExpanded}
                                onToggleExpanded={() => setInvestigateExpanded((prev) => !prev)}
                            />
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
                                            color: isLoading ? 'transparent' : 'var(--color-text-tertiary)',
                                            WebkitTextFillColor: isLoading ? 'transparent' : undefined,
                                        }}
                                    >
                                        {thoughtHeaderText}
                                    </Box>
                                    {canToggleThoughts && (
                                        <ExpandMoreIcon
                                            sx={{
                                                fontSize: '16px',
                                                color: 'var(--color-text-tertiary)',
                                                transform: thoughtsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        )}

                        {/* The opening line, while the run is still going. It cannot live in the
                            group list below: that list is gated on `!isLoading`, so every thought
                            group is drawn only after the answer has landed, and during the run the
                            panel is one animated status line. This is the one thing that has to be
                            readable DURING the wait, so it gets its own slot. */}
                        {isAssistant && isLoading && preamble && (
                            <Box sx={{
                                mt: '6px',
                                ml: 1,
                                pl: '10px',
                                borderLeft: '2px solid var(--color-border-default)',
                            }}>
                                <Typography sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '14px',
                                    fontWeight: 400,
                                    lineHeight: 1.5,
                                    color: 'var(--color-text-tertiary)',
                                }}>
                                    {preamble}
                                </Typography>
                            </Box>
                        )}

                        {isAssistant && !isLoading && thoughtsExpanded && hasDisplayGroups && (
                            <Box sx={{
                                mt: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0px',
                                borderLeft: '2px solid var(--color-border-default)',
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

                        {/* Separates the body from the investigate summary and thinking rows
                            above it. The user bubble has none of those, so on that side the
                            margin was just 8px of dead space above the text — 20px above it
                            against 12px below, inside padding that is 12px on both sides. */}
                        <Box mt={isAssistant ? 1 : 0}>
                            {showReloadInMessage ? (
                                <Box
                                    sx={{
                                        backgroundColor: 'var(--color-background-subtle)',
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
                                            color: 'var(--color-text-tertiary)',
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
                                            borderColor: 'var(--color-border-strong)',
                                            color: 'var(--color-text-tertiary)',
                                            '&:hover': {
                                                borderColor: 'var(--color-grey-300)',
                                                backgroundColor: 'var(--color-background-muted)',
                                            },
                                        }}
                                    >
                                        Reload
                                    </MuiButton>
                                </Box>
                            ) : (
                                // While the run is in flight this used to render `null`
                                // unconditionally, so the answer could only appear once
                                // `isProcessing` went false — which is why streaming it made no
                                // visible difference: the text was in state, and the body was
                                // not being drawn. It stays hidden only until there is text to
                                // show, so a deep-research turn (no Delta frames, content empty
                                // until the end) looks exactly as it did before.
                                isLoading && !message.content
                            ) ? null :
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
                                        <div className="markdown-body">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ href, children, title, ...props }) => {
                                                        const isPubMedReference = href?.includes('pubmed.ncbi.nlm.nih.gov');
                                                        const referenceNumber = isPubMedReference ? getReferenceNumber(href) : null;
                                                        if (!isPubMedReference) {
                                                            return <a href={href} title={title} {...props}>{children}</a>;
                                                        }
                                                        // The marker is ours; PubMed should not be sent it.
                                                        const linkHref = hrefWithoutMarker(href);
                                                        // `title` is dropped on purpose: the agent puts the evidence
                                                        // sentence there, and leaving it would show the browser's own
                                                        // tooltip on top of the card that now presents the same quote
                                                        // with the paper it came from.
                                                        return (
                                                            <a
                                                                href={linkHref}
                                                                {...props}
                                                                onMouseEnter={(event) => showReferenceCard(href, event.currentTarget)}
                                                                onMouseLeave={hideReferenceCard}
                                                                onFocus={(event) => showReferenceCard(href, event.currentTarget)}
                                                                onBlur={hideReferenceCard}
                                                            >
                                                                <span className="inline-citation-number">{referenceNumber || children}</span>
                                                            </a>
                                                        );
                                                    },
                                                }}
                                            >
                                                {stripUnresolvedCitations(
                                                    bindMarkersToLinks(
                                                        stripCitationsBlock(
                                                            isLoading
                                                                ? tidyStreamingText(message.content)
                                                                : message.content,
                                                        ),
                                                        citationsByMarker,
                                                    ),
                                                )}
                                            </ReactMarkdown>
                                            {hoverCard && (
                                                <ReferenceHoverCard
                                                    reference={hoverCard.reference}
                                                    citation={hoverCard.citation}
                                                    number={hoverCard.number}
                                                    anchorRect={hoverCard.rect}
                                                    isBookmarked={bookmarkedPmids.has(
                                                        String(extractPmidFromReference(hoverCard.reference)),
                                                    )}
                                                    onMouseEnter={cancelHoverClose}
                                                    onMouseLeave={hideReferenceCard}
                                                    onBookmark={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        const pmid = extractPmidFromReference(hoverCard.reference);
                                                        toggleBookmark({ ...hoverCard.reference, pmid })
                                                            .then((next) => window.dispatchEvent(new CustomEvent(
                                                                'glkb-bookmarks-updated', { detail: next },
                                                            )))
                                                            .catch(() => {});
                                                    }}
                                                    onCite={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        copy(`[${hoverCard.number}] ${hoverCard.reference.title || ''} `
                                                            + `PMID: ${extractPmidFromReference(hoverCard.reference)}`);
                                                    }}
                                                    onFullText={() => setHoverCard(null)}
                                                />
                                            )}
                                        </div>
                                    )}
                        </Box>

                        {isAssistant && (
                            <Stack direction="row" spacing={1} mt={2} sx={{ pb: "8px" }}>
                                {!isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={() => copy(message.content)}
                                        title="Copy response"
                                        aria-label="Copy response"
                                    >
                                        <ContentCopyIcon style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-grey-400)' }} />
                                    </IconButton>
                                )}
                                {allowResponseRefresh && isLastUserMessage && !isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={() => refresh(null, index)}
                                        title="Regenerate response"
                                    >
                                        <ReplayIcon style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-grey-400)' }} />
                                    </IconButton>
                                )}
                                {!isLoading && <IconButton size="small" onClick={() => downloadConversation(messageID)} title="Download this Q&A">
                                    <DownloadIcon
                                        aria-label="Download"
                                        style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-grey-400)' }}
                                    />
                                </IconButton>}
                                {!isLoading && (
                                    <IconButton
                                        size="small"
                                        onClick={onOpenFeedback}
                                        title="Share feedback"
                                    >
                                        <ThumbsUpDownIcon style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-grey-400)' }} />
                                    </IconButton>
                                )}
                            </Stack>
                        )}

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
                                <ContentCopyIcon style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-grey-400)' }} />
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
    /**
     * Follow-ups typed while an answer is still being written.
     *
     * The bar used to go dead for the length of a run — measured on live runs, 19 to 68 seconds
     * — so a question that occurred to the reader mid-answer had to be held in their head until
     * the page let them type it. Sending it immediately is not an option either: the agent is
     * mid-stream and a second turn on the same conversation would race the first. So it is
     * queued: the text leaves the reader's hands at once, and the run that carries it starts
     * when the current one ends.
     *
     * A list rather than a single slot — someone who thinks of two things should not have to
     * wait for the first to be answered before writing the second. They go out one at a time,
     * oldest first, each waiting for the previous answer.
     */
    const [queuedPrompts, setQueuedPrompts] = useState([]);
    const queueSeqRef = useRef(0);
    const [chatHistory, setChatHistory] = useState(() => {
        const initialQuery = location.state?.initialQuery;
        if (initialQuery) {
            return [{
                role: 'user',
                content: initialQuery,
                references: [],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                investigateMode: Boolean(location.state?.initialSearchOptions?.investigateEnabled),
            }];
        }
        return getStoredChatHistory();
    });
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingGroups, setStreamingGroups] = useState([]);
    // The cheap-tier opening line as it streams. Held as STATE, not only in the thought refs:
    // the thought list is not rendered at all while `isLoading`, so a ref that only feeds it
    // cannot put anything on screen during the wait this line exists to fill.
    const [preambleText, setPreambleText] = useState('');
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
    const [investigatePhase, setInvestigatePhase] = useState('searching');
    const [investigateFunnel, setInvestigateFunnel] = useState(() => emptyFunnel());
    const [investigateStartedAt, setInvestigateStartedAt] = useState(null);
    const [investigatePercent, setInvestigatePercent] = useState(null);
    const [investigateKeywords, setInvestigateKeywords] = useState([]);
    const [investigatePapers, setInvestigatePapers] = useState([]);
    // The structured fields of the progress frames seen so far (topic, facets, n_claims,
    // n_conflicted, section/step/total). Accumulated rather than replaced, so a later frame that
    // omits a field does not blank the active step's detail block.
    const [investigateDetail, setInvestigateDetail] = useState({});
    const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(() => getNotifyPrefs().email);

    // The same preference has a row in Settings and a toggle here; either can
    // move it, including from another tab.
    useEffect(() => subscribeToNotifyPrefs(
        (prefs) => setNotifyEmailEnabled(prefs.email),
    ), []);
    const [chatInvestigateEnabled, setChatInvestigateEnabled] = useState(false);
    const investigateFunnelRef = useRef(emptyFunnel());
    const investigatePhaseRef = useRef('searching');
    const investigatePercentRef = useRef(null);
    const investigateKeywordsRef = useRef([]);
    const investigatePapersRef = useRef([]);
    const investigateDetailRef = useRef({});
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const abortControllerRef = useRef(null);
    const thinkingStepsRef = useRef([]);
    // The answer as it streams in. `block` rises on every tool call, and only the newest block is
    // the answer — in a ReAct loop the model narrates before each call and that text streams too,
    // so a lower block number means "that was a previous train of thought, throw it away".
    const streamingAnswerRef = useRef({ block: -1, text: '' });
    // Lazily built once. Both of its inputs are stable: `streamingAnswerRef` is a ref and
    // `setChatHistory` is a useState setter, so the drip never captures a stale render.
    const dripRef = useRef(null);
    if (!dripRef.current) {
        dripRef.current = makeDrip({
            getFull: () => streamingAnswerRef.current.text,
            show: (text) => setChatHistory((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (!last || last.role !== 'assistant') return prev;
                if (last.content === text) return prev;
                next[next.length - 1] = { ...last, content: text };
                return next;
            }),
        });
    }
    // A run can still be in flight when the reader leaves the page; nothing should go on
    // painting into a conversation that is no longer mounted.
    useEffect(() => () => dripRef.current?.stop(), []);
    // The cheap-tier opening line, accumulated in place. It occupies ONE entry in the thought
    // list that grows as the chunks land, rather than one entry per chunk — `groupThinkingSteps`
    // would otherwise render a column of two-word fragments.
    const preambleRef = useRef({ text: '', index: -1 });
    const prevSelectedMessageIndexRef = useRef(null);
    const lastAutoSelectedRef = useRef(null);
    const sessionIdRef = useRef(null);
    const runIdRef = useRef(null);
    // The conversation whose answer is currently being recovered, so the two restore
    // paths cannot both poll for it and overwrite each other's result.
    const resumingConversationRef = useRef(null);
    // The clarify round's identifiers, mirrored out of React state.
    //
    // The panel is answered by POSTing to /clarify with (session_id, invocation_id, stage). Issue
    // #12 captured a HAR where all three were plainly on the wire and Skip still produced
    // "Clarification session has expired" with ZERO clarify requests — i.e. the submit handler read
    // them as null. Every other live investigate value here is already mirrored into a ref for the
    // same reason (funnel, phase, percent, papers, session id): a value the SSE handler writes and
    // a click handler reads must not depend on which render each of them closed over.
    const pendingClarificationRef = useRef(null);
    // The ONLY way to set the pending round: the ref and the state must never disagree, or the
    // panel would render one round while submit answers another.
    const applyPendingClarification = useCallback((next) => {
        pendingClarificationRef.current = next || null;
        setPendingClarification(next || null);
    }, []);
    const hasConsumedInitialQueryRef = useRef(false);
    const initialSearchOptionsRef = useRef(null);
    const lastSearchOptionsRef = useRef(null);
    const activeConversationIdRef = useRef(getActiveConversationId());
    const loadingConversationIdRef = useRef(null);
    const activeStreamIdRef = useRef(null);
    const splitContainerRef = useRef(null);
    const isDraggingSplitRef = useRef(false);
    const navigationBypassRef = useRef(false);
    const originalNavigatorMethodsRef = useRef({ push: null, replace: null });
    const navigate = useNavigate();

    /**
     * Tell the reader their report landed. Both completion paths call this, and
     * a run can finish through either, so it fires at most once per run.
     */
    const announcedRunRef = useRef(null);
    const announceInvestigateComplete = useCallback(() => {
        const runId = runIdRef.current || 'current';
        if (announcedRunRef.current === runId) return;
        announcedRunRef.current = runId;
        notifyRunComplete({
            title: 'Investigate finished',
            body: 'Your report is ready to read.',
            onClick: () => navigate('/chat'),
        });
    }, [navigate]);
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
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

// Nothing guards in-app navigation any more: a run survives the route change,
    // so a dialog asking whether to abandon it would be describing something that
    // no longer happens.

    // Closing the tab is the one exit that does end a run, and it needs warning
    // about from whichever page the reader is on — so the handler lives in the
    // layout and reads this registry instead of this component's state.
    const isLoadingRef = useRef(false);
    useEffect(() => {
        isLoadingRef.current = isLoading;
        if (!isLoading) {
            clearActiveRun();
            return;
        }
        // A run id means an investigate run, which the server can be asked about
        // later; a plain answer is only saved against its history id.
        setActiveRun({ kind: runIdRef.current ? 'investigate' : 'chat', runId: runIdRef.current || null });
    }, [isLoading]);

    useEffect(() => () => {
        // Leaving the route does not end the run, so the registry is left alone
        // unless the run had already finished.
        if (!isLoadingRef.current) clearActiveRun();
    }, []);

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

    // Reattach to a run that was still going when the page was reloaded.
    //
    // The server does not stop when the browser goes away: the agent finishes the run and the
    // backend writes the answer to history on its own. What was missing was the client half —
    // every recovery path keyed off `runIdRef`, which a reload destroys, and none of them ran on
    // load. The session id is the address that does survive (sessionStorage, written at submit),
    // and `GET /run?session_id=` answers with the latest run for it, for chat and investigate.
    //
    // Two rules keep the recovery from being worse than the problem:
    //
    //   SINGLE FLIGHT. Two restore paths reach this — the mount-time one a plain reload takes,
    //   and the one that runs when a conversation is opened from the list — and they used to
    //   race. One would reach a miss and write a failure into the message while the other was
    //   still polling; the other then landed the real answer on top. That is the "thinking, then
    //   Sorry, then the answer" flicker.
    //
    //   LOOK BEFORE TOUCHING. The first poll happens with the UI untouched. A run that has
    //   already finished — the common case, because a reload takes longer than the poll — is
    //   rendered directly, with no loading state and no flash of anything else. The spinner goes
    //   back only once the server has actually said "running".
    const resumeUnfinishedRun = useCallback(async (
        conversationId, messages, stillMounted, isInvestigateHint,
    ) => {
        if (!isExchangeUnfinished(messages)) return;
        const key = String(conversationId);
        if (resumingConversationRef.current === key) return;
        const sessionId = getStoredSessionId(conversationId);
        if (!sessionId) return;      // nothing to reconnect to; leave the history as it is
        resumingConversationRef.current = key;

        /* Which kind of run to reattach to. The conversation record answers this now
           (chat_histories.is_investigate); the local mark is the fallback for rows the
           server has not labelled, and for servers that do not carry the column yet. */
        const investigate = isInvestigateHint === true
            || isInvestigateConversation(conversationId);
        const last = messages[messages.length - 1];
        let placeholderAdded = false;

        const showWaiting = () => {
            if (placeholderAdded) return;
            placeholderAdded = true;
            if (last.role === 'user') {
                setChatHistory((prev) => [...prev, {
                    role: 'assistant',
                    content: '',
                    references: [],
                    timestamp: new Date().toISOString(),
                    thinkingSteps: [],
                    thoughtDurationMs: null,
                    trajectory: null,
                    investigateMode: investigate,
                }]);
            }
            setIsLoading(true);
            setIsProcessing(true);
            setStreamingStepName('Reconnecting to your answer...');
        };

        const settle = (patch) => {
            setChatHistory((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                const tail = next[next.length - 1];
                if (tail && tail.role === 'assistant') {
                    next[next.length - 1] = { ...tail, ...patch };
                } else {
                    next.push({
                        role: 'assistant',
                        references: [],
                        timestamp: new Date().toISOString(),
                        thinkingSteps: [],
                        thoughtDurationMs: null,
                        trajectory: null,
                        investigateMode: investigate,
                        ...patch,
                    });
                }
                return next;
            });
            setIsLoading(false);
            setIsProcessing(false);
            setStreamingStepName('');
        };

        const applyRun = (run) => {
            settle({
                content: run.response || '',
                references: parseReferences(run.references),
                trajectory: run.trajectory || null,
                investigateMode: investigate,
                ...(investigate ? { investigatePercent: 100, investigatePhase: 'summary' } : {}),
            });
            if (run.response) llmService.updateMessages(run.response);
        };

        // The answer may already be in history — written there by the backend while the page was
        // reloading. Cheaper and more reliable than the run store, which is in-process memory.
        const answerFromHistory = async () => {
            try {
                const detail = await fetchConversationDetail(conversationId);
                if (!stillMounted()) return true;
                const saved = detail?.messages || [];
                if (!isExchangeUnfinished(saved)) {
                    setChatHistory(saved);
                    setIsLoading(false);
                    setIsProcessing(false);
                    setStreamingStepName('');
                    return true;
                }
            } catch (error) {
                logDev('[LLM] resume history refetch failed', error);
            }
            return false;
        };

        try {
            for (let attempt = 0; attempt < RESUME_MAX_POLLS; attempt += 1) {
                if (!stillMounted()) return;
                let run = null;
                let missing = false;
                try {
                    run = await llmService.getRun({ sessionId });
                } catch (error) {
                    missing = error?.response?.status === 404;
                    if (!missing) logDev('[LLM] resume poll failed', error);
                }
                if (!stillMounted()) return;

                if (run && (run.status === 'complete' || run.response)) {
                    applyRun(run);
                    return;
                }
                if (run?.status === 'error' || missing) {
                    // The run is gone or failed. Its answer may still have reached history before
                    // that happened, so that is checked before anything is declared lost.
                    if (await answerFromHistory()) return;
                    settle({
                        content: run?.error
                            ? `Sorry, this run failed: ${run.error}`
                            : RESUME_LOST_MESSAGE,
                    });
                    return;
                }

                showWaiting();   // only now: the server has said it is still working
                await new Promise((resolve) => setTimeout(resolve, RESUME_POLL_MS));
            }
            if (stillMounted() && !(await answerFromHistory())) {
                settle({ content: RESUME_LOST_MESSAGE });
            }
        } finally {
            if (resumingConversationRef.current === key) {
                resumingConversationRef.current = null;
            }
        }
    }, [llmService]);

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
            /* ...or a question from the home page that this mount has already taken.
            
               Consuming that question removes it from location.state, and this effect lists
               location.state.initialQuery among its dependencies — so clearing it ran the
               effect again, this time with nothing telling it to stand back. It then restored
               whatever conversation was most recent over the top of the question being asked:
               the user's message and the spinner vanished for as long as the detail fetch took,
               and came back only when the first token landed. That is the stutter. The ref is
               set before the state is cleared, so it covers the whole gap. */
            const shouldSkipRestore = hasInitialQuery
                || hasConversationId
                || hasConsumedInitialQueryRef.current;

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
                    // The path a plain reload takes. Fire and forget: it polls for minutes and
                    // the restore must not wait on it.
                    resumeUnfinishedRun(
                        nextActiveId, detail?.messages || [], () => isMounted, detail?.isInvestigate,
                    );
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
    }, [authLoading, isAuthenticated, location.state?.initialQuery, location.state?.conversationId,
        resumeUnfinishedRun]);

    const cancelStreaming = useCallback((options = {}) => {
        const { abort = true } = options;
        if (abort && abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = null;
        activeStreamIdRef.current = null;
        dripRef.current?.stop();
        setIsLoading(false);
        setIsProcessing(false);
        setStreamingGroups([]);
        setPreambleText('');
        setStreamingStepName('');
        thinkingStepsRef.current = [];
        applyPendingClarification(null);
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
                // Queued follow-ups belong to the conversation they were typed into.
                setQueuedPrompts([]);
                llmService.clearHistory();
                // The conversation may have been left mid-answer. Fire and forget: this polls for
                // minutes, and the load itself must not wait on it.
                resumeUnfinishedRun(
                    nextId, detail?.messages || [], () => isMounted, detail?.isInvestigate,
                );
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
    }, [isAuthenticated, location.state, cancelStreaming, llmService, resumeUnfinishedRun]);

    const startNewConversation = useCallback((options = {}) => {
        cancelStreaming();
        if (!options.skipHistoryReset) {
            setChatHistory([]);
        }
        setSelectedMessageIndex(null);
        lastAutoSelectedRef.current = null;
        setHoveredPubmedId(null);
        sessionIdRef.current = null;
        runIdRef.current = null;
        setStreamingStepName('');
        setShowReloadPrompt(false);
        applyPendingClarification(null);
        setClarificationDrafts({});
        setClarificationError('');
        setClarificationSubmitting(false);
        setIsConversationLoading(false);
        setLoadingConversationId(null);
        loadingConversationIdRef.current = null;
        setActiveConversationIdState(null);
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        setQueuedPrompts([]);
        llmService.clearHistory();
    }, [cancelStreaming, llmService]);

    /**
     * Follow the answer down.
     *
     * This ran `scrollIntoView({behavior:'smooth'})` on every state change. While text is
     * streaming that is many times a second, and each call restarts the animation before the
     * previous one has finished — the scroll never settles, which is most of what made the
     * streamed answer look like it was stuttering. It also dragged the view back down when the
     * reader had scrolled up to re-read something earlier in the answer.
     *
     * So: smooth for a settled change, and while a run is in flight instant, at most once per
     * frame, and only when the reader is already at the bottom.
     */
    const scrollFrameRef = useRef(0);
    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'end',
        });
    }, []);

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
    };

    useEffect(() => {
        if (!isProcessing) {
            scrollToBottom(true);
            return undefined;
        }
        const container = messagesContainerRef.current;
        if (container) {
            const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distance > AUTO_FOLLOW_SLACK_PX) return undefined;   // the reader scrolled away
        }
        if (scrollFrameRef.current) return undefined;
        scrollFrameRef.current = rafSchedule(() => {
            scrollFrameRef.current = 0;
            scrollToBottom(false);
        });
        return () => {
            if (scrollFrameRef.current) {
                rafCancel(scrollFrameRef.current);
                scrollFrameRef.current = 0;
            }
        };
    }, [chatHistory, streamingGroups, isProcessing, scrollToBottom]);

    // Debounced rather than written on every change: this is a synchronous main-thread write of
    // `JSON.stringify(chatHistory)` — the whole conversation, references included — and it ran
    // once per streamed chunk. The tab only needs the latest state, not every intermediate one.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const id = setTimeout(() => {
            sessionStorage.setItem('llmChatHistory', JSON.stringify(chatHistory));
        }, CHAT_PERSIST_DEBOUNCE_MS);
        return () => clearTimeout(id);
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
            const searchOptions = location.state.initialSearchOptions || null;
            // Consuming the query means REMOVING it. React Router keeps navigation state in
            // `history.state`, which the browser restores on reload, but the ref that says it has
            // already been used is component state and does not survive one. So a refresh re-ran
            // the question: a second full agent run, billed again, while the first run's answer —
            // which the server was still writing to history — was never shown.
            const { initialQuery: _consumedQuery, initialSearchOptions: _consumedOptions,
                    ...restState } = location.state;
            navigate(location.pathname, {
                replace: true,
                state: Object.keys(restState).length ? restState : null,
            });
            initialSearchOptionsRef.current = searchOptions;
            if (searchOptions?.investigateEnabled) {
                setChatInvestigateEnabled(true);
            }
            if (!isLoading) {
                startNewConversation({ skipHistoryReset: true });
                handleSubmit(null, query, null, {
                    forceNewConversation: true,
                    searchOptions,
                });
            }
        }
    }, [location.state, location.pathname, navigate, isLoading, startNewConversation]);

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
        setIsReferencesCollapsed(true);
    }, [isReferencesCollapsed]);

    const expandReferences = useCallback(() => {
        setIsReferencesCollapsed(false);
    }, []);

    useEffect(() => {
        if (useMobileReferencesDrawer || !splitContainerRef.current) return undefined;

        const updateReferenceLayout = () => {
            setIsReferencesCollapsed(
                splitContainerRef.current.getBoundingClientRect().width < MIN_SPLIT_WIDTH_WITH_REFERENCES
            );
        };

        updateReferenceLayout();
        const resizeObserver = new ResizeObserver(updateReferenceLayout);
        resizeObserver.observe(splitContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [useMobileReferencesDrawer]);

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
                // The PMC full text, where the paper has one. This function rebuilds references
                // through a whitelist, so a field it does not name is silently dropped — which is
                // what happened to this one: the agent sent it and nothing downstream ever saw it.
                fulltext_url: ref?.fulltext_url || '',
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
        const investigateEnabled = Boolean(
            requestSearchOptions?.investigateEnabled ?? chatInvestigateEnabled,
        );
        // Discard expired investigate session on explicit retry (clarify session expiry)
        const resetInvestigateSession = Boolean(options.resetInvestigateSession);
        // Keep latest non-expired query options for clarify retry (no session_id reuse)
        lastSearchOptionsRef.current = {
            investigateEnabled,
            filters: Array.isArray(requestSearchOptions?.filters) ? requestSearchOptions.filters : undefined,
            rankingMode: typeof requestSearchOptions?.rankingMode === 'string'
                ? requestSearchOptions.rankingMode
                : undefined,
            maxArticles: Number.isFinite(Number(requestSearchOptions?.maxArticles))
                ? Number(requestSearchOptions.maxArticles)
                : undefined,
        };

        // Create new user message
        const newMessage = {
            role: 'user',
            content: inputText,
            references: [],
            timestamp: t || timestamp,
            investigateMode: investigateEnabled,
        };

        /* Paint before waiting on anything.
        
           These used to run after the conversation had been created, which is a network round
           trip: the question sat unrendered and the panel showed no sign of having started for
           as long as that took. Nothing below needs them to have waited — the conversation id
           is not part of what they draw. */
        setChatHistory([...baseHistory, newMessage]);
        // Only when the text came from the box. Every caller that passes `input` is resending
        // something else — a queued follow-up, an edited message, a retry — and the box may now
        // hold a draft the reader is in the middle of writing. It could not before, because the
        // box was disabled for the length of a run; now that it is live, clearing it here would
        // delete their work.
        if (!input) setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);

        let historyId = activeConversationIdRef.current;
        if (shouldStartNewConversation && isAuthenticated) {
            try {
                const leadingTitle = inputText.trim().slice(0, 200) || null;
                const conversation = await createConversation(leadingTitle, investigateEnabled);
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
        // History tells an investigate conversation from a chat by its icon, and the
        // conversation list the API returns carries no such flag — so note it here,
        // where the app is the one deciding.
        if (investigateEnabled && historyId) {
            markInvestigateConversation(historyId);
        }
        if (resetInvestigateSession) {
            sessionIdRef.current = null;
            setStoredSessionId(historyId, null);
        } else {
            sessionIdRef.current = getStoredSessionId(historyId) || sessionIdRef.current;
        }
        // An investigate run must know its session id BEFORE the stream opens, because that id is
        // the only address a clarify round can be answered at. See mintSessionId.
        //
        // A chat run now mints one too. The id is also the address a RUN is recovered at
        // (`GET /run?session_id=`), and after a reload it is the only one left: the run id lives
        // in a ref that the reload destroys. The agent honours a client-supplied id and only
        // invents its own when we send none, so choosing it here changes nothing about the run
        // and gives the reload something to reconnect to.
        if (!sessionIdRef.current) {
            sessionIdRef.current = mintSessionId();
        }
        // Persist it NOW, not when the run finishes. It used to be written on the `Saved` frame,
        // which arrives at the END of the run — precisely never, for the case that needs it: a
        // reader who reloads while the answer is still being written.
        if (historyId) {
            setStoredSessionId(historyId, sessionIdRef.current);
        }

        // The question and the spinner are already up — see above.
        setStreamingGroups([]);
        setPreambleText('');
        setStreamingStepName('');
        applyPendingClarification(null);
        setClarificationDrafts({});
        setClarificationError('');
        setClarificationSubmitting(false);
        // Start at `planning`, not `searching`: the panel is mounted here, at submit, and must
        // already be moving before the first SSE frame arrives (the agent's own T0 frame follows
        // within milliseconds, but the network round-trip should not be a visible dead spot).
        setInvestigatePhase('planning');
        setInvestigateFunnel(emptyFunnel());
        setInvestigateStartedAt(investigateEnabled ? requestStartedAt : null);
        setInvestigatePercent(investigateEnabled ? PHASE_PERCENT_FLOOR.planning : null);
        setInvestigateKeywords([]);
        setInvestigatePapers([]);
        setInvestigateDetail({});
        investigateFunnelRef.current = emptyFunnel();
        investigatePhaseRef.current = 'planning';
        investigatePercentRef.current = investigateEnabled ? PHASE_PERCENT_FLOOR.planning : null;
        investigateKeywordsRef.current = [];
        investigatePapersRef.current = [];
        investigateDetailRef.current = {};
        thinkingStepsRef.current = [];
        streamingAnswerRef.current = { block: -1, text: '' };
        dripRef.current.reset();
        preambleRef.current = { text: '', index: -1 };

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
                    case 'started':
                        if (!isActiveStream) return;
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        if (update.runId) {
                            runIdRef.current = update.runId;
                        }
                        if (update.phase) {
                            investigatePhaseRef.current = update.phase;
                            setInvestigatePhase(update.phase);
                        }
                        if (update.funnel) {
                            investigateFunnelRef.current = mergeFunnel(investigateFunnelRef.current, update.funnel);
                            setInvestigateFunnel({ ...investigateFunnelRef.current });
                        }
                        {
                            const nextPct = mergePercentMonotonic(investigatePercentRef.current, update.percent);
                            investigatePercentRef.current = nextPct;
                            setInvestigatePercent(nextPct);
                            if (update.keywords) {
                                investigateKeywordsRef.current = mergeLiveKeywords(
                                    investigateKeywordsRef.current,
                                    update.keywords,
                                );
                                setInvestigateKeywords([...investigateKeywordsRef.current]);
                            }
                            if (update.papers) {
                                investigatePapersRef.current = mergeLivePapers(
                                    investigatePapersRef.current,
                                    update.papers,
                                );
                                setInvestigatePapers([...investigatePapersRef.current]);
                            }
                            if (update.label) {
                                setStreamingStepName(update.label);
                            }
                        }
                        break;
                    case 'clarification':
                        if (!isActiveStream) return;
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        applyPendingClarification({
                            invocationId: update.invocationId || null,
                            stage: update.stage || null,
                            sessionId: update.sessionId || sessionIdRef.current || null,
                            reason: update.reason || '',
                            questions: Array.isArray(update.questions) ? update.questions : [],
                        });
                        setClarificationDrafts(buildClarificationDrafts(update.questions));
                        setClarificationError('');
                        setClarificationSubmitting(false);
                        // Figma Asking Question: hold bar + keep phase; do not advance percent
                        if (update.funnel) {
                            investigateFunnelRef.current = mergeFunnel(investigateFunnelRef.current, update.funnel);
                            setInvestigateFunnel({ ...investigateFunnelRef.current });
                        }
                        setStreamingStepName('Asking user question...');
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

                            // Apply live progress even when content is empty (agent progress frames)
                            {
                                const nextPhase = mergePhaseMonotonic(
                                    investigatePhaseRef.current,
                                    update.phase || inferInvestigatePhase(update.step, rawContent),
                                );
                                if (nextPhase && nextPhase !== investigatePhaseRef.current) {
                                    investigatePhaseRef.current = nextPhase;
                                    setInvestigatePhase(nextPhase);
                                }
                                if (update.funnel) {
                                    investigateFunnelRef.current = mergeFunnel(
                                        investigateFunnelRef.current,
                                        update.funnel,
                                    );
                                    setInvestigateFunnel({ ...investigateFunnelRef.current });
                                }
                                const nextPct = mergePercentMonotonic(
                                    investigatePercentRef.current,
                                    update.percent ?? PHASE_PERCENT_FLOOR[nextPhase],
                                );
                                investigatePercentRef.current = nextPct;
                                setInvestigatePercent(nextPct);
                                if (update.keywords) {
                                    investigateKeywordsRef.current = mergeLiveKeywords(
                                        investigateKeywordsRef.current,
                                        update.keywords,
                                    );
                                    setInvestigateKeywords([...investigateKeywordsRef.current]);
                                }
                                if (update.papers) {
                                    investigatePapersRef.current = mergeLivePapers(
                                        investigatePapersRef.current,
                                        update.papers,
                                    );
                                    setInvestigatePapers([...investigatePapersRef.current]);
                                }
                                if (update.label || update.isProgress) {
                                    setStreamingStepName(update.label || update.content || update.step);
                                }
                                if (update.detail && typeof update.detail === 'object') {
                                    investigateDetailRef.current = mergeInvestigateDetail(
                                        investigateDetailRef.current,
                                        update.detail,
                                        update.label,
                                    );
                                    setInvestigateDetail({ ...investigateDetailRef.current });
                                }
                                // Capture progress labels as rich phase markers
                                if (update.isProgress && update.label && update.phase) {
                                    thinkingStepsRef.current = [...thinkingStepsRef.current, {
                                        step: update.step || update.phase,
                                        content: update.label,
                                        isProgress: true,
                                        phase: update.phase,
                                    }];
                                }
                            }

                            if (hasContent && !update.isProgress) {
                                const newEntry = { step: update.step, content: rawContent };
                                thinkingStepsRef.current = [...thinkingStepsRef.current, newEntry];
                                const parsedEntry = parseThinkingEntry(newEntry);
                                if (parsedEntry.stepName) {
                                    setStreamingStepName(parsedEntry.stepName);
                                }

                                const nextPhase = mergePhaseMonotonic(
                                    investigatePhaseRef.current,
                                    update.phase || inferInvestigatePhase(update.step, rawContent),
                                );
                                if (nextPhase && nextPhase !== investigatePhaseRef.current) {
                                    investigatePhaseRef.current = nextPhase;
                                    setInvestigatePhase(nextPhase);
                                }
                                // Structured funnel fields only — see mergeFunnel. Raw tool-log lines
                                // used to be regex-scraped for numbers here, which wrote figures
                                // pulled out of unrelated tool output straight into the counters.
                                if (update.funnel) {
                                    investigateFunnelRef.current = mergeFunnel(
                                        investigateFunnelRef.current,
                                        update.funnel,
                                    );
                                    setInvestigateFunnel({ ...investigateFunnelRef.current });
                                }
                                {
                                    const nextPct = mergePercentMonotonic(
                                        investigatePercentRef.current,
                                        update.percent ?? PHASE_PERCENT_FLOOR[nextPhase],
                                    );
                                    investigatePercentRef.current = nextPct;
                                    setInvestigatePercent(nextPct);
                                    if (update.keywords) {
                                        investigateKeywordsRef.current = mergeLiveKeywords(
                                            investigateKeywordsRef.current,
                                            update.keywords,
                                        );
                                        setInvestigateKeywords([...investigateKeywordsRef.current]);
                                    }
                                    if (update.papers) {
                                        investigatePapersRef.current = mergeLivePapers(
                                            investigatePapersRef.current,
                                            update.papers,
                                        );
                                        setInvestigatePapers([...investigatePapersRef.current]);
                                    }
                                    if (update.label || update.isProgress) {
                                        setStreamingStepName(update.label || update.content || update.step);
                                    }
                                }

                                // Groups are keyed on the mapped step wording, so a step still
                                // shows up while streaming even though its raw trace is withheld.
                                setStreamingGroups((prev) => {
                                    if (!parsedEntry.stepName) {
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
                    case 'thinking': {
                        if (!isActiveStream) return;
                        const pre = preambleRef.current;
                        pre.text += update.delta;
                        const entry = { step: 'Thinking', content: pre.text, isThought: true };
                        if (pre.index < 0) {
                            pre.index = thinkingStepsRef.current.length;
                            thinkingStepsRef.current = [...thinkingStepsRef.current, entry];
                        } else {
                            const next = [...thinkingStepsRef.current];
                            next[pre.index] = entry;
                            thinkingStepsRef.current = next;
                        }
                        setPreambleText(pre.text);
                        // `thinkingStepsRef` is what the FINISHED message carries; the live view
                        // renders `streamingGroups`, which until now was only ever written from
                        // `case 'step'`. Without this the opening line was invisible for the whole
                        // run and only surfaced, collapsed, once the answer had already landed —
                        // i.e. exactly when it is no longer worth reading.
                        //
                        // Matched by name rather than by "the last group": the line keeps growing
                        // while the run's own progress steps are being appended after it.
                        setStreamingGroups((prev) => {
                            const group = { name: 'Thinking', lines: [pre.text] };
                            const at = prev.findIndex((g) => g.name === 'Thinking');
                            if (at < 0) return [...prev, group];
                            const next = [...prev];
                            next[at] = group;
                            return next;
                        });
                        break;
                    }
                    case 'delta': {
                        if (!isActiveStream) return;
                        const buf = streamingAnswerRef.current;
                        if (update.block > buf.block) {
                            // A new block: whatever streamed before it was the model talking its
                            // way to a tool call, not the answer. It is worth showing — it is the
                            // only glimpse of the model's own reasoning the transport carries, and
                            // it arrives long before any answer text does — so it goes into the
                            // body as it streams and moves into the thought list here, once the
                            // block it belonged to has ended.
                            const narration = buf.text.trim();
                            if (narration) {
                                thinkingStepsRef.current = [...thinkingStepsRef.current, {
                                    step: 'Thinking',
                                    content: narration,
                                    isThought: true,
                                }];
                            }
                            streamingAnswerRef.current = { block: update.block, text: update.delta };
                            dripRef.current.reset();
                        } else if (update.block === buf.block) {
                            streamingAnswerRef.current = { block: buf.block, text: buf.text + update.delta };
                        } else {
                            return;   // a straggler from a block already superseded
                        }
                        dripRef.current.start();
                        break;
                    }
                    case 'answer': {
                        if (!isActiveStream) return;
                        // The authoritative text. It replaces the streamed accumulation rather
                        // than being appended to it: `Complete` will carry this same string, and
                        // the citation markers are rewritten server-side after the last chunk, so
                        // the streamed copy is a preview and this is the real thing.
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        streamingAnswerRef.current = { block: Number.MAX_SAFE_INTEGER, text: update.answer || '' };
                        // No drip here: this is the finished text, and the reader has already
                        // watched most of it arrive. Holding the tail back now would be delay
                        // for its own sake.
                        dripRef.current.flush(update.answer || '');
                        // The run is NOT over: references, citations and the graph query list are
                        // still on their way. Keep the spinner, but say what it is waiting for —
                        // the answer is already on screen and readable.
                        setStreamingStepName('Finalizing references...');
                        break;
                    }
                    case 'final':
                        if (!isActiveStream) return;
                        // The whole message is replaced below; anything still queued is stale.
                        dripRef.current.stop();
                        if (update.sessionId) {
                            sessionIdRef.current = update.sessionId;
                        }
                        applyPendingClarification(null);
                        setClarificationDrafts({});
                        setClarificationError('');
                        setClarificationSubmitting(false);
                        setIsProcessing(false);
                        setStreamingStepName('');
                        if (update.funnel) {
                            investigateFunnelRef.current = mergeFunnel(
                                investigateFunnelRef.current,
                                update.funnel,
                            );
                        }
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                directCitations: parseDirectCitations(update.directCitations),
                                timestamp: timestamp,
                                thinkingSteps: thinkingStepsRef.current,
                                thoughtDurationMs: Date.now() - requestStartedAt,
                                trajectory: update.trajectory || null,
                                investigateMode: investigateEnabled,
                                investigateFunnel: { ...investigateFunnelRef.current },
                                investigatePhase: investigatePhaseRef.current || 'verifying',
                                investigatePercent: mergePercentMonotonic(
                                    investigatePercentRef.current,
                                    update.percent ?? 100,
                                ) ?? 100,
                                investigateKeywords: [...(investigateKeywordsRef.current || [])],
                                investigatePapers: [...(investigatePapersRef.current || [])],
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
                        applyPendingClarification(null);
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
                investigateEnabled,
                notifyEmail: (investigateEnabled && notifyEmailEnabled)
                    ? (getUserNotifyEmail() || undefined)
                    : undefined,
                messagesOverride: [...baseHistory, newMessage].map((msg) => ({
                    role: msg?.role,
                    content: msg?.content,
                })),
            });
        } catch (error) {
            console.error('Error in chat:', error);
            // Deep Research disconnect recovery: poll GET /run/{run_id}
            if (investigateEnabled && runIdRef.current && activeStreamIdRef.current === streamId) {
                try {
                    const run = await llmService.getRun({ runId: runIdRef.current });
                    if (run && (run.status === 'complete' || run.response)) {
                        announceInvestigateComplete();
                        applyPendingClarification(null);
                        setIsProcessing(false);
                        setStreamingStepName('');
                        setChatHistory((prev) => {
                            const newHistory = [...prev];
                            newHistory[newHistory.length - 1] = {
                                role: 'assistant',
                                content: run.response || '',
                                references: parseReferences(run.references),
                                timestamp,
                                thinkingSteps: thinkingStepsRef.current,
                                thoughtDurationMs: Date.now() - requestStartedAt,
                                trajectory: run.trajectory || null,
                                investigateMode: true,
                                investigateFunnel: { ...investigateFunnelRef.current },
                                investigatePhase: 'verifying',
                                investigatePercent: investigatePercentRef.current ?? 100,
                                investigateKeywords: [...(investigateKeywordsRef.current || [])],
                                investigatePapers: [...(investigatePapersRef.current || [])],
                            };
                            if (run.response) {
                                llmService.updateMessages(run.response);
                            }
                            return newHistory;
                        });
                        refreshTierStatus();
                        if (activeStreamIdRef.current === streamId) {
                            setIsLoading(false);
                            setIsProcessing(false);
                            activeStreamIdRef.current = null;
                        }
                        return;
                    }
                } catch (recoverError) {
                    logDev('[LLM] run recovery failed', recoverError);
                }
            }
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
                applyPendingClarification(null);
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
                otherSelected: Boolean(nextDraft?.otherSelected),
            },
        }));
    }, []);

    const hasInvalidOtherSelection = useMemo(() => {
        const questions = pendingClarification?.questions;
        if (!Array.isArray(questions)) return false;
        return questions.some((question, index) => {
            const responseType = String(question?.response_type || 'text').toLowerCase();
            if (responseType !== 'single') return false;
            const questionKey = getClarificationQuestionKey(question, index);
            const draft = clarificationDrafts[questionKey];
            if (!draft?.otherSelected) return false;
            return !String(draft.text || '').trim();
        });
    }, [pendingClarification, clarificationDrafts]);

    const submitClarification = useCallback(async ({ useDefaults = false } = {}) => {
        // Read the round from the ref FIRST. This handler is reached from a click deep inside a
        // memoised MessageCard; the ref is written by the SSE handler the instant the frame lands
        // and cannot be a render behind. State is kept as the fallback so the two can only
        // disagree in the direction of "the ref is fresher".
        const { questions, sessionId, invocationId, stage } = resolveClarifyRound(
            pendingClarificationRef.current, pendingClarification, sessionIdRef.current,
        );
        // Last-resort guard. handleSubmit mints the session id before the stream opens and the
        // agent puts invocation_id + stage on every clarification frame, so all three are present
        // by construction. The old copy here said the session had "expired", which was a guess —
        // nothing had timed out, we simply had no address to answer at — and it sent the user off
        // to re-ask, which bills a second full run. Issue #12 asked for exactly this: "Missing
        // session_id / invocation_id → fix client state, do not invent 'expired'."
        if (!invocationId || !stage || !sessionId) {
            logDev('[LLM] clarify: incomplete round', { invocationId, stage, sessionId });
            // Deliberately does NOT promise the run will carry on: clarify.timeout_s is null, so a
            // round nobody can answer leaves the run paused rather than proceeding on defaults.
            setClarificationError(
                'Could not identify this clarification round, so your answers cannot be sent and '
                + 'this investigation cannot continue. Please ask your question again.',
            );
            return;
        }

        setClarificationSubmitting(true);
        setClarificationError('');
        try {
            const answers = useDefaults
                ? []
                : buildClarifyAnswers(questions, clarificationDrafts);

            const result = await llmService.clarify({
                invocation_id: invocationId,
                stage,
                session_id: sessionId,
                answers,
            });

            applyPendingClarification(null);
            setClarificationDrafts({});
            setClarificationError('');
            setClarificationSubmitting(false);

            if (result?.resolved === false) {
                const retryQuestion = typeof result?.retry_question === 'string'
                    ? result.retry_question.trim()
                    : '';
                if (retryQuestion) {
                    message.info('Clarification session expired. Restarting with your answers applied.');
                    const prior = lastSearchOptionsRef.current || {};
                    handleSubmit(null, retryQuestion, null, {
                        resetInvestigateSession: true,
                        searchOptions: {
                            investigateEnabled: true,
                            filters: prior.filters,
                            rankingMode: prior.rankingMode,
                            maxArticles: prior.maxArticles,
                        },
                    });
                } else {
                    message.info('Clarification session not found. Continuing with default research scope.');
                }
            }
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.message || 'Unable to submit clarification.';
            setClarificationError(String(detail));
            setClarificationSubmitting(false);
        }
    }, [clarificationDrafts, llmService, pendingClarification]);

    // Resume completed DR runs if the tab was backgrounded / SSE dropped quietly
    useEffect(() => {
        if (!isLoading) return undefined;

        const tryRecover = async () => {
            if (!runIdRef.current) return;
            try {
                const run = await llmService.getRun({ runId: runIdRef.current });
                if (!(run && (run.status === 'complete' || run.response))) return;
                announceInvestigateComplete();
                applyPendingClarification(null);
                setIsProcessing(false);
                setStreamingStepName('');
                setIsLoading(false);
                setChatHistory((prev) => {
                    if (!prev.length) return prev;
                    const newHistory = [...prev];
                    const last = newHistory[newHistory.length - 1];
                    if (!last || last.role !== 'assistant' || last.content) return prev;
                    newHistory[newHistory.length - 1] = {
                        ...last,
                        content: run.response || '',
                        references: parseReferences(run.references),
                        thinkingSteps: thinkingStepsRef.current,
                        thoughtDurationMs: last.thoughtDurationMs || null,
                        trajectory: run.trajectory || null,
                        investigateMode: true,
                        investigateFunnel: { ...investigateFunnelRef.current },
                        investigatePhase: 'verifying',
                        investigatePercent: investigatePercentRef.current ?? 100,
                        investigateKeywords: [...(investigateKeywordsRef.current || [])],
                        investigatePapers: [...(investigatePapersRef.current || [])],
                    };
                    if (run.response) llmService.updateMessages(run.response);
                    return newHistory;
                });
                activeStreamIdRef.current = null;
            } catch (error) {
                logDev('[LLM] visibility run recovery failed', error);
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                tryRecover();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        const intervalId = window.setInterval(tryRecover, 45000);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.clearInterval(intervalId);
        };
    }, [isLoading, llmService]);

    // Deliberately no abort on unmount. Changing page used to cancel the
    // request, which is the one thing that actually loses the work: the server
    // keeps going, a plain answer is saved against its history id and an
    // investigate run can be re-read by its run id, so leaving the route is
    // survivable. Aborting was not.
    useEffect(() => () => {}, []);

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
            openLoginModal();
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
            openLoginModal();
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
            openLoginModal();
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

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || isProcessing) return undefined;

        const updateSelectedResponse = () => {
            const containerRect = container.getBoundingClientRect();
            const anchorY = containerRect.top + (containerRect.height * 0.38);
            const assistantCards = Array.from(container.querySelectorAll('.message-card[data-message-role="assistant"]'));
            if (!assistantCards.length) return;

            const visibleCards = assistantCards.filter((card) => {
                const cardRect = card.getBoundingClientRect();
                return cardRect.bottom > containerRect.top && cardRect.top < containerRect.bottom;
            });
            const candidates = visibleCards.length ? visibleCards : assistantCards;
            const activeCard = candidates.reduce((closest, card) => {
                const closestDistance = Math.abs(closest.getBoundingClientRect().top - anchorY);
                const cardDistance = Math.abs(card.getBoundingClientRect().top - anchorY);
                return cardDistance < closestDistance ? card : closest;
            });
            const nextIndex = Number(activeCard.dataset.messageIndex);
            if (Number.isInteger(nextIndex)) {
                setSelectedMessageIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
            }
        };

        let animationFrameId = requestAnimationFrame(updateSelectedResponse);
        const handleScroll = () => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(updateSelectedResponse);
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            cancelAnimationFrame(animationFrameId);
            container.removeEventListener('scroll', handleScroll);
        };
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
        // Only the last assistant card is the one being written, and every use of the live-run
        // props inside MessageCard sits behind its `isLoading`. Handing those props to the
        // settled cards too changed their props on every frame, so each streamed chunk
        // re-rendered — and re-parsed the markdown of — every answer in the conversation.
        const lastIndex = chatHistory.length - 1;
        return (<Box sx={{ p: isPhoneDevice ? 1 : 2 }}>{chatHistory.map((message, index) => {
            const isStreamingCard = isProcessing
                && index === lastIndex
                && message.role === 'assistant';
            return (
            <MessageCard
                key={index}
                index={index}
                message={message}
                totalMessages={chatHistory.length}
                isProcessing={isProcessing}
                streamingGroups={isStreamingCard ? streamingGroups : NO_GROUPS}
                preamble={isStreamingCard ? preambleText : ''}
                streamingStepName={isStreamingCard ? streamingStepName : ''}
                investigatePhase={isStreamingCard ? investigatePhase : null}
                investigateFunnel={isStreamingCard ? investigateFunnel : null}
                investigateStartedAt={isStreamingCard ? investigateStartedAt : null}
                investigatePercent={isStreamingCard ? investigatePercent : null}
                investigateKeywords={isStreamingCard ? investigateKeywords : NO_KEYWORDS}
                investigatePapers={isStreamingCard ? investigatePapers : NO_PAPERS}
                investigateDetail={isStreamingCard ? investigateDetail : NO_DETAIL}
                pendingClarification={pendingClarification}
                clarificationDrafts={clarificationDrafts}
                clarificationError={clarificationError}
                clarificationSubmitting={clarificationSubmitting}
                hasInvalidOtherSelection={hasInvalidOtherSelection}
                onUpdateClarificationDraft={updateClarificationDraft}
                onSubmitClarification={submitClarification}
                onSkipClarification={submitClarification}
                refresh={stableRefresh}
                copy={stableCopy}
                save={stableSave}
                downloadConversation={stableDownload}
                onOpenFeedback={stableOpenFeedback}
                showReloadPrompt={showReloadPrompt}
                onReloadLatest={stableReloadLatest}
                onStop={handleStopStreaming}
            />
            );
        })}
        {queuedPrompts.map((item) => (
            <Container
                key={item.id}
                className="message-pair queued-prompt"
                sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', mb: '5px', justifyContent: 'flex-end' }}
            >
                <Box className="queued-prompt-bubble">
                    <span className="queued-prompt-text">{item.text}</span>
                    <button
                        type="button"
                        className="queued-prompt-remove"
                        title="Remove from queue"
                        aria-label={`Remove queued question: ${item.text}`}
                        onClick={() => removeQueuedPrompt(item.id)}
                    >
                        <CloseIcon sx={{ fontSize: 16 }} />
                    </button>
                </Box>
            </Container>
        ))}
        </Box>);
    };

    const [sortOption, setSortOption] = useState('Year');
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [hoveredPubmedId, setHoveredPubmedId] = useState(null);
    const [isReferenceScopeOpen, setIsReferenceScopeOpen] = useState(false);
    const referencesListRef = useRef(null);
    const referenceSourceOptions = useMemo(() => chatHistory
        .map((item, itemIndex) => {
            const refs = Array.isArray(item?.references) ? item.references : [];
            if (item?.role !== 'assistant' || refs.length === 0) return null;
            const previousUserMessage = chatHistory
                .slice(0, itemIndex)
                .reverse()
                .find((entry) => entry?.role === 'user' && entry?.content);
            const label = previousUserMessage?.content || item?.content || `Response ${itemIndex + 1}`;
            return {
                index: itemIndex,
                label: String(label).replace(/\s+/g, ' ').trim(),
                count: refs.length,
            };
        })
        .filter(Boolean), [chatHistory]);

    const selectedReferenceSource = referenceSourceOptions.find((item) => item.index === selectedMessageIndex) || null;

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
        const sorted = enrichedReferences.map((reference, originalIndex) => ({ reference, originalIndex }));
        const getCitationSortValue = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : -1;
        };
        if (sortOption === 'Citations') {
            sorted.sort(({ reference: a }, { reference: b }) => (
                getCitationSortValue(b.citation_count) - getCitationSortValue(a.citation_count)
            ));
        } else {
            sorted.sort(({ reference: a }, { reference: b }) => (a.year || 0) - (b.year || 0));
        }
        return sorted;
    }, [enrichedReferences, sortOption]);
    const isExportDisabled = sortedReferences.length === 0;

    const handleExportReferences = () => {
        if (sortedReferences.length === 0) return;

        const bibTexContent = sortedReferences.map(({ reference: ref }) => {
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

    // Hovering a citation brings its entry into view in the references panel.
    //
    // Deliberately not scrollIntoView: that scrolls *every* scrollable ancestor
    // of the target, not just the list, so bringing an entry to the middle of
    // the panel also nudged the column the citation itself lives in. The chip
    // slid out from under the pointer, which is a mouseout, which closed the
    // card the hover had just opened — the card blinked away exactly as the
    // scroll arrived. Scrolling the list and nothing else leaves the chip where
    // the pointer left it.
    useEffect(() => {
        const list = referencesListRef.current;
        if (!hoveredPubmedId || !list) return;

        // Scoped to the list for the same reason: both the desktop panel and the
        // mobile drawer mark their entries, and a document-wide query answers
        // with whichever is first in the DOM rather than the one on screen.
        const target = list.querySelector(`[data-pubmed-id="${hoveredPubmedId}"]`);
        if (!target) return;

        // Rects rather than offsetTop: offsetTop is measured from the nearest
        // positioned ancestor, which is not necessarily this list.
        const offset = target.getBoundingClientRect().top - list.getBoundingClientRect().top;
        const centred = offset - (list.clientHeight - target.offsetHeight) / 2;
        list.scrollTo({ top: Math.max(0, list.scrollTop + centred), behavior: 'smooth' });
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

    // Declared here, after every handler above exists, and read by `renderMessages` — which is
    // defined earlier but only called from the JSX below. Without these the memo on MessageCard
    // never held: six props were a new function on every render.
    const stableSubmit = useStableCallback(handleSubmit);

    /**
     * Send now, or queue if an answer is still being written.
     *
     * The decision is made here rather than in the bar so the bar keeps one action with one
     * meaning — "this text is finished, take it" — whatever the run happens to be doing.
     */
    const submitOrQueue = useCallback((event, searchOptions) => {
        event?.preventDefault?.();
        const text = userInput.trim();
        if (!text || isLimitReachedEffective) return;
        if (!isLoading) {
            stableSubmit(event, null, null, { searchOptions });
            return;
        }
        queueSeqRef.current += 1;
        setQueuedPrompts((prev) => [...prev, {
            id: `q-${queueSeqRef.current}`,
            text,
            // Captured now rather than read at send time: they describe the turn the reader
            // meant to ask for.
            searchOptions,
        }]);
        setUserInput('');
    }, [userInput, isLoading, isLimitReachedEffective, stableSubmit]);

    const removeQueuedPrompt = useCallback((id) => {
        setQueuedPrompts((prev) => prev.filter((item) => item.id !== id));
    }, []);

    /**
     * Release the oldest queued prompt once nothing is in flight.
     *
     * Guarded by a ref as well as by the flags: `handleSubmit` is async and does not flip
     * `isLoading` until it has built the request, so two renders inside that window would
     * otherwise send the same prompt twice. The guard is held for the whole run — the promise
     * `handleSubmit` returns settles when the stream does — so the next one waits its turn.
     */
    const flushingQueueRef = useRef(false);
    useEffect(() => {
        if (isLoading || isProcessing || isConversationLoading) return;
        if (!queuedPrompts.length || isLimitReachedEffective) return;
        if (flushingQueueRef.current) return;
        flushingQueueRef.current = true;
        const [next, ...rest] = queuedPrompts;
        setQueuedPrompts(rest);
        Promise.resolve(
            stableSubmit(null, next.text, null, { searchOptions: next.searchOptions }),
        ).finally(() => {
            flushingQueueRef.current = false;
        });
    }, [
        isLoading, isProcessing, isConversationLoading,
        queuedPrompts, isLimitReachedEffective, stableSubmit,
    ]);

    const stableRefresh = useStableCallback(handleRegenerateResponse);
    const stableCopy = useStableCallback(handleCopyMessage);
    const stableSave = useStableCallback(handleSaveEdit);
    const stableDownload = useStableCallback(handleDownloadConversation);
    const stableOpenFeedback = useStableCallback(handleOpenFeedback);
    const stableReloadLatest = useStableCallback(handleReloadLatest);

    /* Nothing to show: no conversation restored, nothing streaming, and no question
       handed over from the home page.
       
       This used to be the "Explore Biomedical Literature" screen — a second home page,
       reachable by typing /chat, and shown for as long as it took the first token to
       arrive after a question was submitted, which is why it flashed. Home is the page
       that does this job, so go there instead of drawing an emptier version of it.
       
       Deliberately not an unconditional redirect on /chat: recovering a run after a
       reload arrives here with no router state either, and sending that to the home
       page would undo it. What separates the two is whether there is a conversation
       to restore. */
    const hasNothingToShow = !isConversationLoading
        && !isProcessing
        // A question handed over from the home page is on its way: the state that carried it
        // has already been cleared, and the conversation it will live in does not exist yet.
        // Reading "nothing to show" in that window sent the asker back to the home page.
        && !hasConsumedInitialQueryRef.current
        && chatHistory.length === 0
        && !activeConversationId
        && !location.state?.initialQuery
        && !location.state?.conversationId;

    if (hasNothingToShow) {
        return <Navigate to="/" replace />;
    }

    return (
        <>
            <Helmet>
                <title>AI Chat - Genomic Literature Knowledge Base</title>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=forum" />
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

            {/* Clarify is inline in the investigate message (Figma Asking Question). Modal kept disabled. */}
            <Dialog
                open={false}
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
                        color: 'var(--color-grey-900)',
                    }}
                >
                    Clarify Your Research Scope
                </DialogTitle>
                <DialogContent>
                    <Typography
                        sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '14px',
                            color: 'var(--color-text-tertiary)',
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
                                backgroundColor: 'var(--color-brand-subtle)',
                                border: '1px solid var(--color-border-default)',
                                px: 1.5,
                                py: 1,
                                mb: 2,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '12px',
                                    color: 'var(--color-blue-700)',
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
                            const draft = clarificationDrafts[questionKey] || { selected: [], text: '', otherSelected: false };
                            const selected = Array.isArray(draft.selected) ? draft.selected : [];
                            const otherText = typeof draft.text === 'string' ? draft.text : '';
                            const responseType = String(question?.response_type || 'text').toLowerCase();
                            const options = Array.isArray(question?.options) ? question.options : [];
                            const radioValue = draft.otherSelected ? '__other__' : (selected[0] || '');

                            return (
                                <Box
                                    key={questionKey}
                                    sx={{
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: '12px',
                                        p: 1.5,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontFamily: 'DM Sans, sans-serif',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: 'var(--color-text-tertiary)',
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
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: 'var(--color-text-secondary)',
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
                                                            otherSelected: true,
                                                        });
                                                        return;
                                                    }
                                                    updateClarificationDraft(questionKey, {
                                                        selected: nextValue ? [nextValue] : [],
                                                        text: '',
                                                        otherSelected: false,
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
                                                        otherSelected: true,
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
                                fontSize: '12px',
                                color: 'var(--color-status-error-text)',
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
                            border: '1px solid var(--color-border-strong)',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            color: 'var(--color-grey-600)',
                        }}
                    >
                        Skip (Use Defaults)
                    </MuiButton>
                    <MuiButton
                        disabled={clarificationSubmitting || hasInvalidOtherSelection}
                        onClick={() => submitClarification({ useDefaults: false })}
                        sx={{
                            borderRadius: '10px',
                            border: '1px solid var(--color-brand-primary)',
                            backgroundColor: 'var(--color-brand-primary)',
                            textTransform: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            color: 'var(--color-neutral-white)',
                            '&:hover': {
                                backgroundColor: 'var(--color-blue-600)',
                                borderColor: 'var(--color-blue-600)',
                            },
                        }}
                    >
                        {clarificationSubmitting ? 'Submitting...' : 'Submit Answers'}
                    </MuiButton>
                </DialogActions>
            </Dialog>

            {/* The leave-while-running dialog is gone with the guard that raised it. */}

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
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            Share your feedback
                        </Typography>
                        <IconButton onClick={handleCloseFeedback} aria-label="Close feedback dialog">
                            <ClearIcon sx={{ color: 'var(--color-text-tertiary)' }} />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Typography
                            sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '16px',
                                fontWeight: '400 !important',
                                lineHeight: 1.5,
                                color: 'var(--color-text-secondary)',
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
                                            color: feedbackRating >= star ? '#F5AF18' : 'var(--color-grey-200)',
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
                                    color: 'var(--color-text-secondary)',
                                    '& fieldset': {
                                        borderColor: 'var(--color-grey-400)',
                                    },
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: 'var(--color-grey-400)',
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
                                border: '1px solid var(--color-border-strong)',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-background-surface)',
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
                                backgroundColor: 'var(--color-brand-primary)',
                                color: 'var(--color-neutral-white)',
                                textTransform: 'none',
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '16px',
                                fontWeight: '400 !important',
                                lineHeight: 1.3,
                                px: '16px',
                                py: '8px',
                                minWidth: '170px',
                                '&:hover': {
                                    backgroundColor: 'var(--color-blue-600)',
                                },
                                '&.Mui-disabled': {
                                    backgroundColor: 'var(--color-blue-200)',
                                    color: 'var(--color-neutral-white)',
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
                                color: 'var(--color-text-secondary)',
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
                                            <Box
                                                className="llm-column"
                                                sx={{
                                                    flex: useMobileReferencesDrawer || isReferencesCollapsed
                                                        ? '1 1 auto'
                                                        : `0 0 ${leftPaneWidth}%`,
                                                    minWidth: useMobileReferencesDrawer ? 0 : `${LEFT_MIN_PX}px`,
                                                }}
                                            >
                                                <div className="chat-container">
                                                    <Box className="llm-header" sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0 24px',
                                                        height: '66px',
                                                        backgroundColor: 'var(--color-background-surface)',
                                                    }}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            minWidth: 0,
                                                            flex: 1,
                                                        }}>
                                                            <Typography sx={{
                                                                fontFamily: 'Geist, sans-serif',
                                                                fontSize: '14px',
                                                                fontWeight: 600,
                                                                lineHeight: '18px',
                                                                color: 'var(--color-grey-900)',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                maxWidth: '420px',
                                                            }}>
                                                                {chatTitle}
                                                            </Typography>
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
                                                                    color: isConversationBookmarked ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
                                                                    '&:hover': {
                                                                        backgroundColor: 'var(--color-background-subtle)',
                                                                    },
                                                                }}
                                                                title={isConversationBookmarked ? 'Remove bookmark' : 'Bookmark this chat'}
                                                            >
                                                                {isConversationBookmarked ? (
                                                                    <BookmarkIcon sx={{ fontSize: 16 }} />
                                                                ) : (
                                                                    <BookmarkBorderIcon sx={{ fontSize: 16 }} />
                                                                )}
                                                            </IconButton>
                                                        </Box>
                                                        {!useMobileReferencesDrawer && isReferencesCollapsed && (
                                                            <MuiButton
                                                                className="llm-header-references-toggle"
                                                                onClick={expandReferences}
                                                                startIcon={<ReferenceIcon />}
                                                            >
                                                                References
                                                            </MuiButton>
                                                        )}
                                                    </Box>

                                                    <div ref={messagesContainerRef} className="messages-container">
                                                        {!isConversationLoading && renderMessages()}
                                                        <div ref={messagesEndRef} />
                                                    </div>
                                                    {isConversationLoading && loadingConversationId && (
                                                        <div className="chat-loading-overlay">
                                                            <CircularProgress size={28} sx={{ color: 'var(--color-grey-900)' }} />
                                                            <Typography sx={{
                                                                fontFamily: 'Open Sans, sans-serif',
                                                                fontSize: '14px',
                                                                fontWeight: 400,
                                                                color: 'var(--color-text-tertiary)',
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
                                                                border: "1px solid var(--color-brand-primary)",
                                                                bgcolor: "var(--color-grey-25)",
                                                                color: "var(--color-brand-primary)",
                                                                "& .MuiButton-startIcon": {
                                                                    color: "var(--color-brand-primary)",
                                                                },
                                                                "& .MuiSvgIcon-root": {
                                                                    color: "var(--color-brand-primary)",
                                                                },
                                                        >
                                                            Send
                                                                    color: "var(--color-brand-primary)",
                                                                    boxShadow: index == selectedMessageIndex ? "0 0 0 1px var(--color-brand-primary)" : "none",
                                                            icon={<DeleteOutlined />}
                                                                boxShadow: index == selectedMessageIndex ? "0 0 0 1px var(--color-brand-primary)" : "none",
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
                                                    {/* Figma "Asking Question" hangs the panel off the
                                                        composer (111:4385 sits at y=-502 inside the
                                                        input bar frame), not in the message stream:
                                                        it is a question to answer before the run can
                                                        go on, so it belongs where the answer is typed
                                                        and must not scroll away with the transcript. */}
                                                    <div className="composer-dock">
                                                        {pendingClarification && (
                                                            <div className="clarify-float">
                                                                <ClarifyPanel
                                                                    pendingClarification={pendingClarification}
                                                                    clarificationDrafts={clarificationDrafts}
                                                                    clarificationError={clarificationError}
                                                                    clarificationSubmitting={clarificationSubmitting}
                                                                    hasInvalidOtherSelection={hasInvalidOtherSelection}
                                                                    onUpdateDraft={updateClarificationDraft}
                                                                    onSubmit={() => submitClarification({ useDefaults: false })}
                                                                    onSkip={() => submitClarification({ useDefaults: true })}
                                                                />
                                                            </div>
                                                        )}
                                                    <ChatSearchBar
                                                        userInput={userInput}
                                                        setUserInput={setUserInput}
                                                        isLoading={isLoading}
                                                        isQueryLimitReached={isLimitReachedEffective}
                                                        investigateEnabled={chatInvestigateEnabled}
                                                        onSubmit={(event) => submitOrQueue(event, {
                                                            investigateEnabled: chatInvestigateEnabled,
                                                            ...(initialSearchOptionsRef.current || {}),
                                                        })}
                                                        onStop={handleStopStreaming}
                                                    />
                                                    </div>
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
                                                    <Box className="llm-column references-column" sx={{ flex: 1, minWidth: `${RIGHT_MIN_PX}px` }}>
                                                        <IconButton
                                                            size="small"
                                                            className="references-collapse-toggle"
                                                            onClick={collapseReferences}
                                                            aria-label="Collapse references"
                                                            title="Collapse references"
                                                        >
                                                            <ChevronRightIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                        <div style={{ height: '100%', width: '100%' }}>
                                                            <div className="references-container">
                                                                <div className="references-header-row">
                                                                    <div className="references-header-main">
                                                                        <h3 className="references-title">References</h3>
                                                                        <button
                                                                            type="button"
                                                                            className="references-scope-trigger"
                                                                            onClick={() => setIsReferenceScopeOpen((prev) => !prev)}
                                                                            aria-expanded={isReferenceScopeOpen}
                                                                        >
                                                                            <span className="material-symbols-outlined references-scope-icon" aria-hidden="true">forum</span>
                                                                            <span>{selectedReferenceSource?.label || 'Select a response'}</span>
                                                                            <ChevronRightIcon className={`references-scope-chevron${isReferenceScopeOpen ? ' expanded' : ''}`} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {isReferenceScopeOpen && (
                                                                    <div className="references-scope-panel">
                                                                        {referenceSourceOptions.map((item, optionIndex) => (
                                                                            <button
                                                                                key={item.index}
                                                                                type="button"
                                                                                className="references-scope-option"
                                                                                onClick={() => {
                                                                                    setSelectedMessageIndex(item.index);
                                                                                    setIsReferenceScopeOpen(false);
                                                                                }}
                                                                            >
                                                                                <span className="references-scope-option-label">
                                                                                    <span className="references-scope-option-number">{optionIndex + 1}.</span> {item.label}
                                                                                </span>
                                                                                <span className={`references-scope-radio${selectedMessageIndex === item.index ? ' selected' : ''}`} />
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <div className="references-toolbar-row">
                                                                    {/* While a run is in flight the count is not yet knowable — "0 Citations"
                                                                        reads as "this answer has no sources", so show nothing until it lands. */}
                                                                    <span className="references-count-label">
                                                                        {isProcessing && sortedReferences.length === 0
                                                                            ? ''
                                                                            : `${sortedReferences.length} Citations`}
                                                                    </span>
                                                                    <div className="references-toolbar-actions">
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
                                                                                    width: '14px',
                                                                                    height: '14px',
                                                                                    display: 'block',
                                                                                    color: isExportDisabled ? 'var(--color-grey-300)' : 'var(--color-text-tertiary)',
                                                                                }}
                                                                            />
                                                                        </IconButton>
                                                                        <ToggleButtonGroup
                                                                            size="small"
                                                                            exclusive
                                                                            value={sortOption}
                                                                            onChange={(event, value) => {
                                                                                if (value !== null) {
                                                                                    setSortOption(value);
                                                                                }
                                                                            }}
                                                                            className="references-sort-toggle"
                                                                        >
                                                                            <ToggleButton value="Citations">Citation</ToggleButton>
                                                                            <ToggleButton value="Year">Year</ToggleButton>
                                                                        </ToggleButtonGroup>
                                                                    </div>
                                                                </div>

                                                                {sortedReferences.length > 0 ? (
                                                                    <div ref={referencesListRef} className="references-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                                                        {sortedReferences.map(({ reference: ref, originalIndex }) => {
                                                                            const url = [
                                                                                ref.title,
                                                                                ref.url,
                                                                                ref.citation_count,
                                                                                ref.year,
                                                                                ref.journal,
                                                                                ref.authors,
                                                                                // [6] the real full text, where the paper has one
                                                                                ref.fulltext_url,
                                                                            ];
                                                                            const pubmedId = ref.url.split('/').filter(Boolean).pop();
                                                                            const isHighlighted = hoveredPubmedId === pubmedId;
                                                                            return (
                                                                                <div
                                                                                    key={`${pubmedId}-${originalIndex}`}
                                                                                    data-pubmed-id={pubmedId}
                                                                                    className={`reference-entry-wrapper${isHighlighted ? ' highlighted' : ''}`}
                                                                                >
                                                                                    <ReferenceCard
                                                                                        url={url}
                                                                                        evidence={ref.evidence}
                                                                                        sourceHid={activeConversationIdRef.current || activeConversationId}
                                                                                        handleClick={handleClick}
                                                                                        onCiteClick={handleCiteClick}
                                                                                        isHighlighted={isHighlighted}
                                                                                        index={originalIndex + 1}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : isProcessing ? (
                                                                    <ReferencesSkeleton />
                                                                ) : (
                                                                    <p style={{ padding: '16px 32px' }}>No references available for this response.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Box>
                                                </>
                                            )}
                                        </Box>
                                        {useMobileReferencesDrawer && (
                                            <Drawer
                                                anchor="bottom"
                                                open={isMobileReferencesDrawerOpen}
                                                onClose={() => setIsMobileReferencesDrawerOpen(false)}
                                                PaperProps={{ className: 'llm-mobile-references-drawer' }}
                                            >
                                                <div className="references-container llm-mobile-references-container">
                                                    <div className="references-header-row">
                                                        <h3 className="references-title">References</h3>
                                                        <div className="references-toolbar-actions">
                                                            <ToggleButtonGroup
                                                                size="small"
                                                                exclusive
                                                                value={sortOption}
                                                                onChange={(event, value) => {
                                                                    if (value !== null) {
                                                                        setSortOption(value);
                                                                    }
                                                                }}
                                                                className="references-sort-toggle"
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
                                                                        width: '14px',
                                                                        height: '14px',
                                                                        display: 'block',
                                                                        color: isExportDisabled ? 'var(--color-grey-300)' : 'var(--color-text-tertiary)',
                                                                    }}
                                                                />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                className="references-action-button"
                                                                onClick={() => setIsMobileReferencesDrawerOpen(false)}
                                                                title="Close references"
                                                            >
                                                                <ChevronRightIcon sx={{ color: 'var(--color-text-tertiary)', transform: 'rotate(90deg)' }} />
                                                            </IconButton>
                                                        </div>
                                                    </div>

                                                    {sortedReferences.length > 0 ? (
                                                        <div ref={referencesListRef} className="references-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingLeft: '1rem', paddingRight: '1rem' }}>
                                                            {sortedReferences.map(({ reference: ref, originalIndex }) => {
                                                                const url = [
                                                                    ref.title,
                                                                    ref.url,
                                                                    ref.citation_count,
                                                                    ref.year,
                                                                    ref.journal,
                                                                    ref.authors,
                                                                    ref.fulltext_url,
                                                                ];
                                                                const pubmedId = ref.url.split('/').filter(Boolean).pop();
                                                                const isHighlighted = hoveredPubmedId === pubmedId;
                                                                return (
                                                                    <div
                                                                        key={`${pubmedId}-${originalIndex}`}
                                                                        data-pubmed-id={pubmedId}
                                                                        className={`reference-entry-wrapper${isHighlighted ? ' highlighted' : ''}`}
                                                                    >
                                                                        <ReferenceCard
                                                                            url={url}
                                                                            evidence={ref.evidence}
                                                                            sourceHid={activeConversationIdRef.current || activeConversationId}
                                                                            handleClick={handleClick}
                                                                            onCiteClick={handleCiteClick}
                                                                            isHighlighted={isHighlighted}
                                                                            index={originalIndex + 1}
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
