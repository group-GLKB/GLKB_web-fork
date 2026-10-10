/**
 * The Literature Review pipeline's client: its own endpoints, its own stream.
 *
 * Deliberately NOT routed through `LLMAgentService.chat`: Literature Review is a separate
 * pipeline end to end (backend `/api/v1/literature-review`, glkb-agent `literature_review/`), and
 * keeping its client apart is what lets `LITERATURE_REVIEW_ENABLED` switch it off without
 * touching anything chat or Investigate depend on.
 *
 * The stream is read the way the chat stream is (the shared axios instance, so the base URL and
 * the JWT interceptor apply; SSE text parsed as it arrives through `onDownloadProgress`).
 */
import axios from '../utils/axiosConfig';

const BASE = '/api/v1/literature-review';

export const cancelReview = async (runId) => {
    if (!runId) return null;
    const { data } = await axios.post(`${BASE}/run/${encodeURIComponent(runId)}/cancel`);
    return data;
};

/**
 * Write one review. `onFrame` receives every parsed frame in order:
 *   {step:'Started', history_id, public_id} (backend) · {step:'Started', run_id} (service)
 *   {type:'progress', phase, label, percent, detail}
 *   {step:'Complete', response, references, usage} · {step:'Saved', public_id}
 *   {step:'Error', error}
 */
export const streamReview = async ({
    question, serviceTier, model, historyId, signal, targetWords, cutoffYear, articleTypes, notify,
}, onFrame) => {
    let buffer = '';
    let processed = 0;
    const consume = (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => {
            if (!line.startsWith('data: ')) return;
            try {
                onFrame(JSON.parse(line.slice(6)));
            } catch (error) {
                /* a malformed frame is skipped, as the chat reader does */
            }
        });
    };
    await axios.post(`${BASE}/stream`, {
        question,
        // The model is picked as a chat's is, by service tier (`model` only for a caller naming one).
        ...(serviceTier ? { service_tier: serviceTier } : {}),
        ...(model ? { model } : {}),
        ...(historyId ? { history_id: historyId } : {}),
        // The review's scope; omitted, the service plans its own default length up to this year.
        ...(targetWords ? { target_words: targetWords } : {}),
        ...(cutoffYear ? { cutoff_year: cutoffYear } : {}),
        // PubMed publication types to keep to; 'all' is the service's default and not sent.
        ...(articleTypes && articleTypes !== 'all' ? { article_types: articleTypes } : {}),
        // Mail the reader's own account address when the review is saved.
        ...(notify ? { notify: true } : {}),
    }, {
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        responseType: 'text',
        signal,
        onDownloadProgress: (progressEvent) => {
            const xhr = progressEvent.event?.target || progressEvent.target;
            const text = xhr?.responseText;
            if (!text) return;
            const chunk = text.slice(processed);
            processed = text.length;
            if (chunk) consume(chunk);
        },
    });
    if (buffer.trim()) consume('\n');
};
