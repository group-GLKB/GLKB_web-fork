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

/** POST `body` to `url` and hand each `data:` frame of the SSE reply to `onFrame` as it arrives. */
const streamFrames = async (url, body, signal, onFrame) => {
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
    await axios.post(url, body, {
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

/**
 * Write one review. `onFrame` receives every parsed frame in order:
 *   {step:'Started', history_id, public_id} (backend) · {step:'Started', run_id} (service)
 *   {type:'progress', phase, label, percent, detail} · {type:'sections', title, sections}
 *   {step:'Complete', response, references, usage} · {step:'Saved', public_id}
 *   {step:'Error', error}
 * With `outlineApproval` the run stops once the outline is planned: {step:'Outline', run_id, outline}
 * comes instead of Complete, and approveOutline() writes it.
 */
export const streamReview = ({
    question, serviceTier, model, historyId, signal, targetWords, startYear, cutoffYear, articleTypes, notify,
    papers, sources, outlineApproval,
}, onFrame) => streamFrames(`${BASE}/stream`, {
    question,
    // The model is picked as a chat's is, by service tier (`model` only for a caller naming one).
    ...(serviceTier ? { service_tier: serviceTier } : {}),
    ...(model ? { model } : {}),
    ...(historyId ? { history_id: historyId } : {}),
    // The review's scope; omitted, the service plans its own default length, from any year up
    // to this one.
    ...(targetWords ? { target_words: targetWords } : {}),
    ...(startYear ? { start_year: startYear } : {}),
    ...(cutoffYear ? { cutoff_year: cutoffYear } : {}),
    // PubMed publication types to keep to; 'all' is the service's default and not sent.
    ...(articleTypes && articleTypes !== 'all' ? { article_types: articleTypes } : {}),
    // Mail the reader's own account address when the outline waits and when the review is saved.
    ...(notify ? { notify: true } : {}),
    // The reader's own papers (attachment ids) and how they are used: alone ('papers') or with
    // the search ('papers_and_search'). Without papers the review searches, as it always has.
    ...(papers?.length ? { papers, sources: sources || 'papers_and_search' } : {}),
    // Stop at the outline for the reader to approve (the design: "You'll approve an outline before
    // any writing starts").
    ...(outlineApproval ? { outline_approval: true } : {}),
}, signal, onFrame);

/**
 * Write the outline a run stopped at, as the reader approved it: `sections` are the ones to write, in
 * order, each {id, title}; `title` is the review's. The same frames as streamReview, into the same
 * conversation.
 */
export const approveOutline = ({ runId, title, sections, signal }, onFrame) => streamFrames(
    `${BASE}/run/${encodeURIComponent(runId)}/outline`,
    { ...(title ? { title } : {}), sections },
    signal, onFrame,
);

/** A saved review's run, when it stopped at its outline: {run_id, status, outline}; null when there is none. */
export const getReviewRun = async (publicId) => {
    try {
        const { data } = await axios.get(`${BASE}/history/${encodeURIComponent(publicId)}/run`);
        return data || null;
    } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
    }
};
