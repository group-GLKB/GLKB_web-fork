/**
 * Internal traces must never reach the user.
 *
 * A run's first seconds used to show this verbatim under "Searching for literature":
 *   [TOOL CALL] article_search | Input: {"question": "How does PD-1/PD-L1 signaling …", "k": 50}
 */
import { humanizeTrace, isInternalTrace } from './traceLabel';

describe('humanizeTrace', () => {
    it('maps a tool call to its step.json wording, dropping the payload', () => {
        const raw = '[TOOL CALL] article_search | Input: {"question": "How does PD-1/PD-L1 '
            + 'signaling contribute to immune evasion in pancreatic cancer?", "k": 50}';
        expect(humanizeTrace(raw)).toBe('Searching for relevant articles');
    });

    it('maps a tool result the same way, so a call and its result read alike', () => {
        expect(humanizeTrace('[TOOL RESULT] vocabulary_search | Output: {"success": true}'))
            .toBe('Exploring the knowledge graph');
    });

    it('maps an agent marker', () => {
        expect(humanizeTrace('[AGENT START] GLKBHarness')).toBe('Running deep investigation');
    });

    it('returns nothing for a trace it cannot name, never the raw payload', () => {
        const out = humanizeTrace('[TOOL CALL] some_new_tool | Input: {"secret": 1}');
        expect(out).toBe('');
        expect(out).not.toMatch(/Input:|secret/);
    });

    it('leaves a real label alone', () => {
        const label = 'Searched the literature — 53 candidate papers found for: ambient RNA';
        expect(humanizeTrace(label)).toBe(label);
    });

    it('handles empty and missing input', () => {
        expect(humanizeTrace('')).toBe('');
        expect(humanizeTrace(null)).toBe('');
        expect(humanizeTrace(undefined)).toBe('');
    });

    it('recognises what is and is not a trace', () => {
        expect(isInternalTrace('[TOOL CALL] article_search | Input: {}')).toBe(true);
        expect(isInternalTrace('[AGENT OUTPUT] x')).toBe(true);
        expect(isInternalTrace('Reading 53 papers')).toBe(false);
        // a citation opening a sentence is not a trace — the tag must be upper case
        expect(isInternalTrace('[12345] reported a 40% reduction')).toBe(false);
    });
});
