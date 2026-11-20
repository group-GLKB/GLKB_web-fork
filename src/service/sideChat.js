/**
 * The side chat (2026-11-20): a quick question about the conversation on screen, answered beside
 * it and never saved. Copied from Claude Code's side chat (`/btw`, ⌘;) and the Codex app's "Open
 * Side Chat".
 *
 * `POST /api/v1/new-llm-agent/side-chat` (glkb-backend `app/services/side_chat.py`): one model
 * call with no tools. It reads
 *   - a signed-in reader's SAVED conversation, named by `history_id` (the backend reads it, the
 *     reader's own only), or, without one, the `turns` sent from here (a guest's conversation,
 *     which is not saved anywhere);
 *   - the RUNNING turn, from here (`in_progress`: its question, the progress lines on screen and
 *     the partial answer) — asking about a turn while it is still being written is the main use;
 *   - the side `thread` so far, the new `question` and an optional `quote`.
 * It is charged like a Low AI Chat question on the reader's tier, and nothing goes into the
 * conversation: no history row, no agent session.
 *
 * The stream: `Delta` frames, then `Complete` (`answer` is the text to keep: the backend removes a
 * PMID the conversation does not contain) or `Error`; either may carry `credits`.
 */
import axios from '../utils/axiosConfig';
import { refusalOf } from './LLMAgent';

export const SIDE_CHAT_ENDPOINT = '/api/v1/new-llm-agent/side-chat';

/* What is sent of a conversation without a saved history (the backend takes at most 60 turns and
   trims further itself). Generous: the agent keeps only what fits its budget, newest first. */
export const MAX_CLIENT_TURNS = 30;
const MAX_ANSWER_CHARS = 60000;
const MAX_QUESTION_CHARS = 8000;
const MAX_REFERENCES = 40;
const MAX_PROGRESS_LINES = 12;
const MAX_PROGRESS_CHARS = 300;
/** The longest side question (the backend's limit). */
export const SIDE_CHAT_QUESTION_MAX = 4000;
/** The side thread sent with a question: its newest messages (the backend takes at most 40). */
export const MAX_THREAD_MESSAGES = 20;

const PUBMED_ID = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/;

const text = (value, max) => {
    const s = typeof value === 'string' ? value : '';
    return max && s.length > max ? s.slice(0, max) : s;
};

/** A message's references as `{ pmid, title, journal, year }` (the shapes the chat holds). */
export const referencesForSideChat = (refs) => (Array.isArray(refs) ? refs : [])
    .slice(0, MAX_REFERENCES)
    .map((ref) => {
        if (Array.isArray(ref)) {
            const [title, url, , year, journal] = ref;
            return { pmid: String(url || '').match(PUBMED_ID)?.[1] || null, title: title || null, journal: journal || null, year: year == null ? null : String(year) };
        }
        const pmid = ref?.pmid ? String(ref.pmid) : (String(ref?.url || '').match(PUBMED_ID)?.[1] || null);
        const year = ref?.year ?? ref?.date ?? null;
        return {
            pmid,
            title: ref?.title ? text(String(ref.title), 1000) : null,
            journal: ref?.journal ? text(String(ref.journal), 300) : null,
            year: year === null || year === undefined || year === '' ? null : text(String(year), 32),
        };
    })
    .filter((ref) => ref.pmid || ref.title);

const isInvestigate = (message) => Boolean(message?.investigateMode)
    || message?.effort === 'extra' || message?.effort === 'max';

/**
 * The conversation as the side chat request carries it.
 *
 *   history_id   a signed-in reader's saved conversation (a number); the backend reads it
 *   turns        otherwise, the finished exchanges held here (oldest first, the newest
 *                MAX_CLIENT_TURNS)
 *   in_progress  the running turn, when `running`: the last question, the answer so far and the
 *                progress lines
 */
export const sideChatContext = ({
    messages = [],
    historyId = null,
    isGuest = false,
    running = false,
    progress = [],
} = {}) => {
    const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
    let finished = list;
    let inProgress = null;
    if (running) {
        let at = list.length - 1;
        while (at >= 0 && list[at].role !== 'user') at -= 1;
        if (at >= 0) {
            const question = list[at];
            const partial = list.slice(at + 1).find((m) => m.role === 'assistant');
            inProgress = {
                question: text(question.content, MAX_QUESTION_CHARS),
                answer: text(partial?.content || '', MAX_ANSWER_CHARS),
                progress: (Array.isArray(progress) ? progress : [])
                    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .slice(-MAX_PROGRESS_LINES)
                    .map((line) => text(line, MAX_PROGRESS_CHARS)),
                investigate: isInvestigate(question) || isInvestigate(partial),
            };
            finished = list.slice(0, at);
        }
    }
    const context = {};
    const id = Number(historyId);
    if (!isGuest && historyId !== null && historyId !== undefined && historyId !== '' && Number.isInteger(id) && id > 0) {
        context.history_id = id;
    } else {
        const turns = [];
        for (let i = 0; i < finished.length; i += 1) {
            const question = finished[i];
            if (question.role !== 'user') continue;
            const answer = finished[i + 1];
            if (!answer || answer.role !== 'assistant' || !String(answer.content || '').trim()) continue;
            turns.push({
                question: text(question.content, MAX_QUESTION_CHARS),
                answer: text(answer.content, MAX_ANSWER_CHARS),
                references: referencesForSideChat(answer.references),
                investigate: isInvestigate(question) || isInvestigate(answer),
            });
        }
        context.turns = turns.slice(-MAX_CLIENT_TURNS);
    }
    if (inProgress && (inProgress.question || inProgress.answer || inProgress.progress.length)) {
        context.in_progress = inProgress;
    }
    return context;
};

/**
 * What a running turn has done so far, as the progress panel shows it: each step group's name with
 * its newest line (`streamingGroups`: `[{ name, lines }]`), then what it is doing now.
 */
export const runProgressLines = ({ groups = [], current = '' } = {}) => {
    const lines = [];
    (Array.isArray(groups) ? groups : []).forEach((group) => {
        const name = String(group?.name || '').trim();
        const items = Array.isArray(group?.lines) ? group.lines : [];
        const last = String(items[items.length - 1] || '').trim();
        if (!name && !last) return;
        lines.push(name && last && last !== name ? `${name}: ${last}` : (name || last));
    });
    const now = String(current || '').trim();
    if (now && !lines.some((line) => line.startsWith(now))) lines.push(`Now: ${now}`);
    return lines.slice(-MAX_PROGRESS_LINES);
};

/** The request body: the context, the side thread's finished messages, the question, the quote. */
export const sideChatRequest = ({ question, quote = '', thread = [], context = {}, serviceTier = '' }) => {
    const body = {
        ...context,
        question: text(String(question || '').trim(), SIDE_CHAT_QUESTION_MAX),
        thread: (Array.isArray(thread) ? thread : [])
            .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && String(m.content || '').trim())
            .slice(-MAX_THREAD_MESSAGES)
            .map((m) => ({ role: m.role, content: text(String(m.content), 20000) })),
    };
    const q = String(quote || '').trim();
    if (q) body.quote = text(q, 8000);
    const tier = typeof serviceTier === 'string' ? serviceTier.trim().toLowerCase() : '';
    if (tier) body.service_tier = tier;
    return body;
};

/** Frames out of an SSE text buffer: `{ frames, rest }`, where `rest` is an unfinished line. */
export const readSseFrames = (buffer) => {
    const lines = String(buffer || '').split('\n');
    const rest = lines.pop() || '';
    const frames = [];
    lines.forEach((line) => {
        if (!line.startsWith('data:')) return;
        try {
            const frame = JSON.parse(line.slice(5).trim());
            if (frame && typeof frame === 'object') frames.push(frame);
        } catch (error) {
            /* a malformed line is skipped, as the chat's reader does */
        }
    });
    return { frames, rest };
};

/**
 * Post a side question and hand each frame to `onFrame` as it arrives. Resolves when the stream
 * ends; rejects with the axios error otherwise (`error.refusal` set for a refusal from before the
 * stream opened: credits, a guest's limit, the switch off, the per-reader bound). An abort
 * (`signal`) resolves quietly.
 */
export const streamSideChat = async (body, { signal, onFrame } = {}) => {
    let processed = 0;
    let buffer = '';
    const consume = (chunk) => {
        const { frames, rest } = readSseFrames(buffer + chunk);
        buffer = rest;
        frames.forEach((frame) => onFrame?.(frame));
    };
    const post = () => axios.post(SIDE_CHAT_ENDPOINT, body, {
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        responseType: 'text',
        signal,
        onDownloadProgress: (progressEvent) => {
            const xhr = progressEvent.event?.target || progressEvent.target;
            const responseText = xhr?.responseText;
            if (!responseText) return;
            const chunk = responseText.slice(processed);
            processed = responseText.length;
            if (chunk) consume(chunk);
        },
    });
    try {
        // 503 CREDITS_BUSY: the balance covers it but concurrent charges raced; one retry after a
        // second, as the chat does. Nothing was taken.
        for (let attempt = 0; ; attempt += 1) {
            try {
                const response = await post();
                // A transport that delivered nothing through the progress callback (a test, an old
                // browser): read the body whole.
                if (!processed && typeof response?.data === 'string') consume(response.data);
                break;
            } catch (error) {
                if (refusalOf(error)?.code !== 'CREDITS_BUSY' || attempt >= 1) throw error;
                await new Promise((resolve) => { setTimeout(resolve, 1000); });
                processed = 0;
                buffer = '';
            }
        }
        if (buffer.trim()) consume('\n');
    } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
        const refusal = refusalOf(error);
        if (refusal) error.refusal = refusal;
        throw error;
    }
};

/** The shortcut's label for this platform: ⌘; on a Mac, Ctrl+; elsewhere. */
export const sideChatShortcutLabel = (platform = (typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '')) => (
    /mac|iphone|ipad|ipod/i.test(String(platform || '')) ? '⌘;' : 'Ctrl+;'
);

/** Whether a keydown is the side chat's shortcut: ⌘; or Ctrl+; (no Alt / Shift). */
export const isSideChatShortcut = (event) => Boolean(event
    && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
    && (event.key === ';' || event.code === 'Semicolon'));
