import axios from '../utils/axiosConfig';
import { humanizeTrace } from './traceLabel';

const DEFAULT_STREAM_ENDPOINT = '/api/v1/new-llm-agent/stream';
const INVESTIGATE_STREAM_ENDPOINT = process.env.REACT_APP_INVESTIGATE_STREAM_ENDPOINT || '/api/v1/deep-research/stream';
const INVESTIGATE_CLARIFY_ENDPOINT = process.env.REACT_APP_INVESTIGATE_CLARIFY_ENDPOINT || '/api/v1/deep-research/clarify';
const INVESTIGATE_RUN_ENDPOINT = process.env.REACT_APP_INVESTIGATE_RUN_ENDPOINT || '/api/v1/deep-research/run';
// Cap on the references a deep-research answer returns. The backend accepts up to 100.
export const INVESTIGATE_MAX_REFERENCES = 50;

const INVESTIGATE_API_BASE_URL = (process.env.REACT_APP_INVESTIGATE_API_BASE_URL || '').trim().replace(/\/+$/, '');

const normalizePath = (path = '') => {
    if (!path || typeof path !== 'string') return '';
    if (/^(https?:)?\/\//i.test(path)) return path;
    return path.startsWith('/') ? path : `/${path}`;
};

const resolveInvestigateUrl = (endpoint, fallback) => {
    const normalizedEndpoint = normalizePath(endpoint || fallback);
    if (!normalizedEndpoint) return fallback;
    if (/^(https?:)?\/\//i.test(normalizedEndpoint)) return normalizedEndpoint;
    if (!INVESTIGATE_API_BASE_URL) return normalizedEndpoint;
    return `${INVESTIGATE_API_BASE_URL}${normalizedEndpoint}`;
};

const resolveInvestigateStreamUrl = () =>
    resolveInvestigateUrl(INVESTIGATE_STREAM_ENDPOINT, DEFAULT_STREAM_ENDPOINT);

const resolveInvestigateClarifyUrl = () =>
    resolveInvestigateUrl(INVESTIGATE_CLARIFY_ENDPOINT, '/api/v1/deep-research/clarify');

const resolveInvestigateRunUrl = (runId) => {
    const base = resolveInvestigateUrl(INVESTIGATE_RUN_ENDPOINT, '/api/v1/deep-research/run');
    if (!runId) return base;
    return `${base.replace(/\/+$/, '')}/${encodeURIComponent(runId)}`;
};

// Phase table lives in its own dependency-free module (the progress panel imports it without
// dragging axios in); re-exported here so existing import sites keep working.
export {
    INVESTIGATE_PHASE_META,
    INVESTIGATE_PHASE_ORDER,
    PHASE_PERCENT_FLOOR,
    phaseIndex,
    phasePercentCap,
} from './investigatePhases';

// Use the shared axios instance (baseURL + JWT interceptors from axiosConfig).
// Do NOT use axios.create() — bare clients miss /reorg-api prefix and auth.

/** Pull optional numeric funnel fields from an agent SSE payload. */
export const extractFunnelMetrics = (data = {}) => {
    const detail = data.detail && typeof data.detail === 'object' ? data.detail : {};
    const source = { ...data, ...detail, ...(data.metrics || {}), ...(data.funnel || {}) };
    const pick = (...keys) => {
        for (const key of keys) {
            const value = source?.[key];
            // An absent or blank field just means "not this alias" — keep looking. This used to
            // `return null` here, which aborted the whole chain on the first missing key: every
            // alias after the first was dead unless the first one happened to be present.
            if (value === null || value === undefined || value === '' || value === '-') continue;
            const num = Number(value);
            if (Number.isFinite(num) && num >= 0) return num;
        }
        return null;
    };

    const retrieved = pick('retrieved', 'retrieved_count', 'n_retrieved', 'n_pool', 'Retrieved');
    const screened = pick('screened', 'screened_count', 'n_screened', 'filtered', 'Screened');
    const extracted = pick(
        'extracted',
        'extracted_papers',
        'extracted_count',
        'n_extracted',
        'Extracted',
    );
    // The agent reports this one as `cited_provisional`; a plain `cited` still wins if it shows up.
    const cited = pick(
        'cited',
        'cited_provisional',
        'cited_count',
        'n_cited',
        'citations',
        'Cited',
    );

    if (
        retrieved === null &&
        screened === null &&
        extracted === null &&
        cited === null
    ) {
        return null;
    }

    return { retrieved, screened, extracted, cited };
};

/** Normalize keywords/queries from progress detail. */
export const extractKeywords = (data = {}) => {
    const detail = data.detail && typeof data.detail === 'object' ? data.detail : {};
    const raw =
        data.queries ||
        data.keywords ||
        data.search_keywords ||
        detail.queries ||
        detail.keywords ||
        detail.search_keywords ||
        null;
    if (!raw) return null;
    const list = Array.isArray(raw) ? raw : [raw];
    const out = list
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
                return String(item.query || item.keyword || item.text || item.label || '').trim();
            }
            return '';
        })
        .filter(Boolean);
    return out.length ? Array.from(new Set(out)) : null;
};

/** Normalize paper objects from progress detail. */
export const extractPapers = (data = {}) => {
    const detail = data.detail && typeof data.detail === 'object' ? data.detail : {};
    const raw =
        data.papers ||
        data.articles ||
        detail.papers ||
        detail.articles ||
        detail.reading ||
        null;
    if (!Array.isArray(raw) || !raw.length) return null;
    const out = raw.map((item, index) => {
        if (typeof item === 'string') {
            const pmidMatch = item.match(/\b(\d{5,9})\b/);
            return {
                id: pmidMatch ? pmidMatch[1] : `p-${index}`,
                pmid: pmidMatch ? pmidMatch[1] : null,
                title: item,
                journal: null,
                year: null,
            };
        }
        const pmid = item?.pmid || item?.PMID || item?.id || null;
        return {
            id: String(pmid || item?.title || index),
            pmid: pmid ? String(pmid) : null,
            title: item?.title || item?.name || (pmid ? `PMID ${pmid}` : 'Untitled'),
            journal: item?.journal || item?.journal_name || null,
            year: item?.year || item?.pub_year || null,
        };
    });
    return out.length ? out : null;
};

/** Clamp percent 0-100; null if missing. */
export const normalizePercent = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.min(100, Math.round(num)));
};

/** Infer investigate phase label from step/content text (Figma stages). */
export const inferInvestigatePhase = (step = '', content = '') => {
    const text = `${step} ${content}`.toLowerCase();
    if (/summary|done —|done -/.test(text)) return 'summary';
    if (/polish|finaliz|placing figures/.test(text)) return 'finalizing';
    if (/verif|check(ing)? every conclusion|evidence.?gate/.test(text)) return 'verifying';
    if (/writ(e|ing)|6-section|investigation report|formulat/.test(text)) return 'writing';
    if (/analyz|organis|organiz|claims|facets|angles|hypothesis/.test(text)) return 'analyzing';
    if (/read(ing)?|fulltext|abstract|fetch_abstract|get_fulltext|paper/.test(text)) return 'reading';
    if (/narrow(ing)? down|screen/.test(text)) return 'screening';
    if (/plan(ning)?\b|investigating/.test(text)) return 'planning';
    if (/search|retriev|keyword|article_search|search_pubmed|clarif/.test(text)) return 'searching';
    if (/start|instruction|mapping|research angles/.test(text)) return 'searching';
    return null;
};

/** Heuristic funnel counts from free-text tool logs when agent omits metrics. */
export const inferFunnelFromText = (lines = []) => {
    const joined = (Array.isArray(lines) ? lines : [lines]).map(String).join('\n');
    const funnel = {
        retrieved: null,
        screened: null,
        extracted: null,
        cited: null,
    };

    const matchNum = (re) => {
        const m = joined.match(re);
        if (!m) return null;
        const n = Number(String(m[1]).replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
    };

    funnel.retrieved =
        matchNum(/(\d[\d,]*)\s*(?:papers?|articles?)?\s*retriev/i) ||
        matchNum(/retriev(?:ed|ing)?\s*[:=]?\s*(\d[\d,]*)/i) ||
        matchNum(/found\s+(\d[\d,]*)\s*(?:papers?|articles?)/i);
    funnel.screened =
        matchNum(/(\d[\d,]*)\s*(?:papers?|articles?)?\s*screen/i) ||
        matchNum(/screen(?:ed|ing)?\s*[:=]?\s*(\d[\d,]*)/i) ||
        matchNum(/reading\s+(\d[\d,]*)\s*paper/i) ||
        matchNum(/read\s+(\d[\d,]*)\s*paper/i);
    funnel.extracted =
        matchNum(/(\d[\d,]*)\s*(?:papers?|articles?|claims?)?\s*extract/i) ||
        matchNum(/extract(?:ed|ing)?\s*[:=]?\s*(\d[\d,]*)/i) ||
        matchNum(/(\d+)\s*claims?/i);
    funnel.cited =
        matchNum(/(\d[\d,]*)\s*(?:papers?|articles?)?\s*cit/i) ||
        matchNum(/cit(?:ed|ing|ations?)?\s*[:=]?\s*(\d[\d,]*)/i);

    if (
        funnel.retrieved === null &&
        funnel.screened === null &&
        funnel.extracted === null &&
        funnel.cited === null
    ) {
        return null;
    }
    return funnel;
};

export class LLMAgentService {
    constructor() {
        this.messages = [];
    }

    async chat(question, abortController, onUpdate, options = {}) {
        try {
            if (Array.isArray(options.messagesOverride)) {
                this.messages = [...options.messagesOverride];
            } else {
                this.messages.push({
                    role: 'user',
                    content: question,
                });
            }

            let buffer = '';
            let processedLength = 0;

            const processSSEChunk = (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);
                        const detail = data.detail && typeof data.detail === 'object' ? data.detail : {};
                        const funnel = extractFunnelMetrics(data);
                        const keywords = extractKeywords(data);
                        const papers = extractPapers(data);
                        const percent = normalizePercent(
                            data.percent ?? data.progress_percent ?? detail.percent ?? null,
                        );
                        // `data.content` on a tool frame is an internal trace
                        // ("[TOOL CALL] article_search | Input: {…}"), so it is mapped to its
                        // step.json wording before it can reach the panel as a label.
                        const label = data.label || detail.label || data.message
                            || humanizeTrace(data.content) || '';
                        const phase =
                            data.phase ||
                            detail.phase ||
                            data.stage_label ||
                            inferInvestigatePhase(data.step || data.type, label);

                        // Agent DR progress frames: type === "progress" (or tool_name progress)
                        const isProgressFrame =
                            data.type === 'progress' ||
                            data.tool_name === 'progress' ||
                            (data.percent != null && data.phase);

                        if (data.step === 'Started') {
                            onUpdate({
                                type: 'started',
                                runId: data.run_id || null,
                                sessionId: data.session_id || null,
                                phase: phase || 'searching',
                                funnel,
                                percent: percent ?? PHASE_PERCENT_FLOOR.searching,
                                keywords,
                                papers,
                                label: label || 'Starting investigation…',
                            });
                        } else if (data.type === 'clarification' || data.step === 'Clarifying the question') {
                            onUpdate({
                                type: 'clarification',
                                invocationId: data.invocation_id || null,
                                stage: data.stage || null,
                                reason: data.reason || '',
                                questions: Array.isArray(data.questions) ? data.questions : [],
                                sessionId: data.session_id || null,
                                phase: phase || 'searching',
                                funnel,
                                percent, // hold bar during clarify
                                keywords,
                                papers,
                            });
                        } else if (data.step === 'Delta') {
                            // Streamed answer chunk. `delta` is an INCREMENT to append, never the
                            // running total. `block` rises each time the agent calls a tool: in a
                            // ReAct loop the model narrates before each call ("I'll search PubMed
                            // for..."), so only the newest block is the answer and earlier blocks
                            // must be discarded rather than concatenated.
                            //
                            // Must stay ABOVE the generic `data.step` progress branch below, which
                            // would otherwise swallow these as ordinary step frames.
                            onUpdate({
                                type: 'delta',
                                delta: data.delta || '',
                                block: Number(data.block) || 0,
                                phase,
                                percent,
                            });
                        } else if (data.step === 'Complete') {
                            onUpdate({
                                type: 'final',
                                answer: data.response,
                                references: data.references || [],
                                messages: data.messages || [],
                                sessionId: data.session_id || null,
                                trajectory: data.trajectory || null,
                                funnel,
                                phase: 'summary',
                                percent: 100,
                                keywords,
                                papers,
                            });
                        } else if (data.step === 'Saved') {
                            onUpdate({
                                type: 'saved',
                                historyId: data.history_id,
                                sessionId: data.session_id || null,
                                invocationId: data.invocation_id || null,
                            });
                        } else if (data.step === 'Error') {
                            onUpdate({
                                type: 'error',
                                error: data.error || data.detail || 'Unknown error',
                                funnel,
                            });
                        } else if (isProgressFrame || data.step) {
                            onUpdate({
                                type: 'step',
                                step: data.step || data.phase || 'Processing',
                                content: label || data.message || data.content || '',
                                phase,
                                funnel,
                                percent,
                                keywords,
                                papers,
                                label,
                                // The frame's remaining structured fields (facets, n_claims,
                                // n_conflicted, section/step/total, topic, …). The progress panel
                                // renders these as the active step's detail block, so they have to
                                // survive the trip instead of being flattened into a label string.
                                detail,
                                isProgress: Boolean(isProgressFrame),
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e, 'Line:', line);
                    }
                }
            };

            const sessionId = options.sessionId || null;
            const investigateEnabled = Boolean(options.investigateEnabled);
            const historyId = Number.isFinite(Number(options.historyId))
                ? Number(options.historyId)
                : null;
            const payload = investigateEnabled
                ? {
                    question,
                    messages: Array.isArray(this.messages)
                        ? this.messages.map((msg) => ({
                            role: msg?.role,
                            content: msg?.content,
                        }))
                        : [],
                    history_id: historyId,
                }
                : {
                    question,
                    history_id: historyId,
                };

            if (sessionId) {
                payload.session_id = sessionId;
            }
            if (Number.isFinite(Number(options.maxArticles))) {
                payload.max_articles = Number(options.maxArticles);
            } else if (investigateEnabled) {
                // `max_articles` truncates the REFERENCE list the agent returns
                // (service/api.py: `references = references[:request.max_articles]`); it never
                // reaches retrieval, so raising it costs nothing and only stops hiding sources the
                // run already found. Nothing sets it on the investigate path — the Search Options
                // control that fed it was removed under Investigate — so the request fell through
                // to the backend's schema default of 20 and the panel read "20 Citations" on every
                // deep-research run regardless of how many papers were actually cited.
                payload.max_articles = INVESTIGATE_MAX_REFERENCES;
            }
            // Deep Research drops filters/ranking_mode — it runs its own hybrid retrieval rather
            // than the agent's search tools. Sending them anyway would be worse than useless: the
            // backend PERSISTS filters onto the conversation, so a selection that did nothing for
            // the investigate turn would silently apply to the next ordinary chat turn.
            if (!investigateEnabled) {
                // Send the array even when empty. Omitting it means "no preference", and
                // the backend then keeps the filter stored on the conversation — so an
                // empty list was the one selection the user could never express, and
                // turning "reviews only" back off did nothing (issue #11).
                if (Array.isArray(options.filters)) {
                    payload.filters = options.filters;
                }
                if (typeof options.rankingMode === 'string' && options.rankingMode.trim()) {
                    payload.ranking_mode = options.rankingMode.trim();
                }
            }
            // Backend PR #31: email when Deep Research hits Complete
            if (
                investigateEnabled &&
                typeof options.notifyEmail === 'string' &&
                options.notifyEmail.trim()
            ) {
                payload.notify_email = options.notifyEmail.trim();
            }

            const streamEndpoint = investigateEnabled ? resolveInvestigateStreamUrl() : DEFAULT_STREAM_ENDPOINT;

            await axios.post(streamEndpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                },
                responseType: 'text',
                signal: abortController.signal,
                onDownloadProgress: (progressEvent) => {
                    const xhr = progressEvent.event?.target || progressEvent.target;
                    const responseText = xhr?.responseText;
                    if (!responseText) return;

                    const chunk = responseText.slice(processedLength);
                    if (!chunk) return;
                    processedLength = responseText.length;
                    processSSEChunk(chunk);
                },
            });

            // Flush trailing buffer without newline
            if (buffer.trim()) {
                processSSEChunk('\n');
            }
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                return;
            }
            console.error('Chat error:', error);
            onUpdate({
                type: 'error',
                error: error.message,
            });
            throw error;
        }
    }

    async clarify(payload) {
        const endpoint = resolveInvestigateClarifyUrl();
        const response = await axios.post(endpoint, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
        return response.data;
    }

    /**
     * Poll a detached deep-research run after SSE disconnect.
     * GET /api/v1/deep-research/run/{run_id}
     * GET /api/v1/deep-research/run?session_id=...
     */
    async getRun({ runId, sessionId } = {}) {
        if (runId) {
            const endpoint = resolveInvestigateRunUrl(runId);
            const response = await axios.get(endpoint, {
                headers: { Accept: 'application/json' },
            });
            return response.data;
        }
        if (sessionId) {
            const endpoint = resolveInvestigateRunUrl();
            const response = await axios.get(endpoint, {
                params: { session_id: sessionId },
                headers: { Accept: 'application/json' },
            });
            return response.data;
        }
        throw new Error('getRun requires runId or sessionId');
    }

    async getAnswer(question) {
        try {
            const response = await axios.post('/api/v1/new-llm-agent/chat', {
                question,
                messages: this.messages,
            });

            return {
                answer: response.data.answer,
                references: response.data.references || [],
                messages: response.data.messages || [],
            };
        } catch (error) {
            console.error('LLM Agent error:', error);
            throw error;
        }
    }

    async rewind(historyId, invocationId) {
        const payload = {
            history_id: historyId,
            invocation_id: invocationId,
        };
        const response = await axios.post('/api/v1/new-llm-agent/rewind', payload);
        return response.data;
    }

    updateMessages(assistantMessage) {
        this.messages.push({
            role: 'assistant',
            content: assistantMessage,
        });
    }

    clearHistory() {
        this.messages = [];
    }
}
