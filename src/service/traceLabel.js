/**
 * Turn the agent's internal traces into wording a person can read.
 *
 * The transport tags tool frames as `step: "Processing"` with the trace in `content`:
 *
 *   [TOOL CALL] article_search | Input: {"question": "How does PD-1/PD-L1 …", "k": 50}
 *   [AGENT START] GLKBHarness
 *
 * The thinking-steps list already strips these (`parseThinkingEntry` in LLMAgent/index.jsx), but
 * the investigate panel reads its label straight off the frame, so in the first seconds of a run —
 * before any real progress frame lands — a raw trace with a JSON payload was what the user saw
 * under "Searching for literature".
 *
 * Mapped through step.json, the same table the thinking list uses, so one tool has one name
 * everywhere. A trace whose tool is not in the table resolves to '' rather than to itself: an
 * empty detail line is better than leaking an argument blob.
 */
import stepLabels from '../components/LLMAgent/step.json';

const STEP_LABELS = stepLabels || {};

// `[TAG] rest` where TAG is the transport's own upper-case marker (TOOL CALL, TOOL RESULT,
// AGENT START, AGENT INPUT, AGENT OUTPUT). Anything else is real content and passes through.
const TRACE = /^\s*\[([A-Z][A-Z ]*)\]\s*(.*)$/s;

export const isInternalTrace = (text) => TRACE.test(String(text || ''));

/**
 * The human wording for one frame's text.
 *   not a trace  -> returned unchanged (a real label must not be mangled)
 *   a known tool -> its step.json wording
 *   anything else-> '' (never the raw payload)
 */
export const humanizeTrace = (text) => {
    const raw = String(text || '');
    const m = raw.match(TRACE);
    if (!m) return raw;

    // "article_search | Input: {…}" -> "article_search"; "GLKBHarness" -> "GLKBHarness"
    const name = m[2].split('|')[0].trim();
    return STEP_LABELS[name] || '';
};

export default humanizeTrace;
