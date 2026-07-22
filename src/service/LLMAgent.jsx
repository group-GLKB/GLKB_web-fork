import axios from '../utils/axiosConfig';

const DEFAULT_STREAM_ENDPOINT = '/api/v1/new-llm-agent/stream';
const INVESTIGATE_STREAM_ENDPOINT = process.env.REACT_APP_INVESTIGATE_STREAM_ENDPOINT || '/api/v1/deep-research/stream';
const INVESTIGATE_CLARIFY_ENDPOINT = process.env.REACT_APP_INVESTIGATE_CLARIFY_ENDPOINT || '/api/v1/deep-research/clarify';
const INVESTIGATE_RUN_ENDPOINT = process.env.REACT_APP_INVESTIGATE_RUN_ENDPOINT || '/api/v1/deep-research/run';
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

// Use the shared axios instance (baseURL + JWT interceptors from axiosConfig).
// Do NOT use axios.create() — bare clients miss /reorg-api prefix and auth.

/** Pull optional numeric funnel fields from an agent SSE payload. */
const extractFunnelMetrics = (data = {}) => {
    const source = data.metrics || data.funnel || data.progress || data;
    const pick = (...keys) => {
        for (const key of keys) {
            const value = source?.[key];
            if (value === null || value === undefined || value === '' || value === '-') return null;
            const num = Number(value);
            if (Number.isFinite(num) && num >= 0) return num;
        }
        return null;
    };

    const retrieved = pick('retrieved', 'retrieved_count', 'n_retrieved', 'Retrieved');
    const screened = pick('screened', 'screened_count', 'n_screened', 'filtered', 'Screened');
    const extracted = pick('extracted', 'extracted_count', 'n_extracted', 'Extracted');
    const cited = pick('cited', 'cited_count', 'n_cited', 'citations', 'Cited');

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

/** Infer investigate phase label from step/content text (Figma stages). */
export const inferInvestigatePhase = (step = '', content = '') => {
    const text = `${step} ${content}`.toLowerCase();
    if (/verif|check(ing)? every conclusion|evidence.?gate/.test(text)) return 'verifying';
    if (/writ(e|ing)|6-section|investigation report|formulat/.test(text)) return 'writing';
    if (/analyz|organis|organiz|claims|facets|angles|hypothesis/.test(text)) return 'analyzing';
    if (/read(ing)?|fulltext|abstract|fetch_abstract|get_fulltext|paper/.test(text)) return 'reading';
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

export const INVESTIGATE_PHASE_META = {
    searching: { title: 'Searching...', etaMin: 6 },
    reading: { title: 'Reading...', etaMin: 5 },
    analyzing: { title: 'Analyzing', etaMin: 4 },
    writing: { title: 'Writing...', etaMin: 3 },
    verifying: { title: 'Verifying...', etaMin: 2 },
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
                        const funnel = extractFunnelMetrics(data);
                        const phase =
                            data.phase ||
                            data.stage_label ||
                            inferInvestigatePhase(data.step, data.message || data.content || '');

                        if (data.step === 'Started') {
                            onUpdate({
                                type: 'started',
                                runId: data.run_id || null,
                                sessionId: data.session_id || null,
                                phase: phase || 'searching',
                                funnel,
                                percent: data.percent ?? data.progress_percent ?? null,
                            });
                        } else if (data.type === 'clarification' || data.step === 'Clarifying the question') {
                            onUpdate({
                                type: 'clarification',
                                invocationId: data.invocation_id || null,
                                stage: data.stage || null,
                                reason: data.reason || '',
                                questions: Array.isArray(data.questions) ? data.questions : [],
                                sessionId: data.session_id || null,
                                phase: 'searching',
                                funnel,
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
                                phase: 'verifying',
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
                        } else if (data.step) {
                            onUpdate({
                                type: 'step',
                                step: data.step,
                                content: data.message || data.content || '',
                                phase,
                                funnel,
                                percent: data.percent ?? data.progress_percent ?? null,
                                keywords: data.keywords || data.search_keywords || null,
                                papers: data.papers || data.articles || null,
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
            }
            if (Array.isArray(options.filters) && options.filters.length > 0) {
                payload.filters = options.filters;
            }
            if (typeof options.rankingMode === 'string' && options.rankingMode.trim()) {
                payload.ranking_mode = options.rankingMode.trim();
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
