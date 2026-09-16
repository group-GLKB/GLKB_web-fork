/**
 * The two guards in the Agent that keep a queued follow-up in its own conversation.
 *
 * Both are single conditions inside a component of several thousand lines with a live stream
 * behind it, so they are asserted in the source; what they protect is covered behaviourally
 * in `service/agentRunSnapshot.identity.test.js` and `utils/chatHistory.liveTurn.test.js`.
 *
 * 1. Only the nameless thread's own run may adopt entries queued against it. The owner key
 *    deliberately outlives a finished turn, so passing it from a run that already HAS a
 *    conversation handed that run another conversation's follow-ups.
 * 2. The visit-time reconcile may not take down the registry mark of a conversation this tab
 *    is answering in the background: with the mark down, everything else queued for it is
 *    released straight onto the run already in flight.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');

describe('which run may claim a nameless queue', () => {
    it('takes the owner key only while the run has no conversation of its own', () => {
        expect(source).toMatch(
            /const queueOwnerKey = targetConversationId == null \? queueOwnerKeyRef\.current : null;/,
        );
    });

    it('claims nothing when there is no owner key, rather than claiming everything', () => {
        // `sameRunKey(null, null)` is true, so an unguarded claim with a null key would
        // adopt every nameless entry in the queue.
        const claims = source.match(/if \(queueOwnerKey\) \{\s*\n\s*setQueuedPrompts\(/g) || [];
        expect(claims).toHaveLength(2);
        expect(source.match(/claimQueuedPrompts\(prev, queueOwnerKey/g)).toHaveLength(2);
    });
});

describe('the stale-mark reconcile', () => {
    it('leaves a conversation this tab is still answering alone, on both paths', () => {
        const guards = source.match(/!backgroundRunsRef\.current\.has\(String\((targetId|nextId)\)\)/g);
        expect(guards).toHaveLength(2);
    });

    it('registers a background turn before the request and clears it after', () => {
        expect(source).toContain('backgroundRunsRef.current.add(String(conversationId));');
        expect(source).toContain('backgroundRunsRef.current.delete(String(conversationId));');
        const add = source.indexOf('backgroundRunsRef.current.add(');
        const request = source.indexOf('await llmService.chat(entry.text');
        const remove = source.indexOf('backgroundRunsRef.current.delete(');
        expect(add).toBeGreaterThan(-1);
        expect(add).toBeLessThan(request);
        expect(remove).toBeGreaterThan(request);
    });
});

describe('removing a follow-up that has been sent', () => {
    it('matches it by the identity that does not change under it', () => {
        expect(source).toContain('const goneIdentity = queueEntryIdentity(entry);');
        expect(source).toMatch(/queueEntryIdentity\(item\) !== goneIdentity/);
    });
});

describe('a released follow-up that is never sent', () => {
    it('is held back until the auth check has answered', () => {
        // The submit path refuses while auth is loading, and the entry is consumed before it
        // is submitted — so releasing into that window loses the question outright.
        expect(source).toContain('if (authLoading || !isAuthenticated) return;');
    });

    it('goes back into the queue when the submit refuses or throws', () => {
        expect(source).toContain('if (started === false) requeueQueuedPrompt(next);');
        expect(source).toMatch(/logDev\('\[LLM\] Queued submit failed', error\);\s*\n\s*requeueQueuedPrompt\(next\);/);
    });

    it('reports a refusal rather than looking like a turn that ran', () => {
        const body = source.slice(source.indexOf('const handleSubmit = async (e, input = null'));
        expect(body.slice(0, 1200)).toContain('return false;');
        expect(body).toContain('// The turn was started; a queued follow-up that reaches here must not be re-queued.');
    });
});
