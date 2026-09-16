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

    it('registers a background turn before the request, and releases it on every exit', () => {
        const add = source.indexOf('backgroundRunsRef.current.add(String(conversationId));');
        const request = source.indexOf('await llmService.chat(entry.text');
        expect(add).toBeGreaterThan(-1);
        expect(add).toBeLessThan(request);
        // One release, reached from the finally (the ordinary end) and from the catch around
        // the setup (a throw before the request ever left).
        expect(source).toContain('backgroundRunsRef.current.delete(String(conversationId));');
        expect(source.match(/releaseBackgroundMarks\(\);/g)).toHaveLength(2);
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
        expect(source).toContain('if (authLoading) return;');
    });

    it('is cleared, not left on screen forever, once there is no account', () => {
        expect(source).toMatch(/if \(!isAuthenticated\) \{[\s\S]{0,600}?queuedPrompts\.forEach\(\(entry\) => removeQueuedPrompt\(entry\)\);/);
    });

    it('goes back into the queue when the submit refuses or throws', () => {
        expect(source).toContain('if (started !== true) requeueQueuedPrompt(next);');
        expect(source).toMatch(/logDev\('\[LLM\] Queued submit failed', error\);\s*\n\s*requeueQueuedPrompt\(next\);/);
        // The background path is a promise too — a throw before the request must not eat it.
        expect(source).toMatch(/Queued background turn failed to start[\s\S]{0,120}requeueQueuedPrompt\(next\);/);
    });

    it('reports a refusal rather than looking like a turn that ran', () => {
        const body = source.slice(source.indexOf('const handleSubmit = async (e, input = null'));
        expect(body.slice(0, 1200)).toContain('return false;');
        expect(body).toContain('// The turn was started; a queued follow-up that reaches here must not be re-queued.');
    });
});

describe('a background turn that never gets off the ground', () => {
    it('takes its own marks down, in this tab and in the shared registry', () => {
        expect(source).toContain('const releaseBackgroundMarks = () => {');
        // Registered, then everything after it is inside the guard that releases them.
        const registered = source.indexOf('backgroundRunsRef.current.add(String(conversationId));');
        const guard = source.indexOf('try {', registered);
        const request = source.indexOf('await llmService.chat(entry.text', registered);
        expect(guard).toBeGreaterThan(registered);
        expect(guard).toBeLessThan(request);
        expect(source).toMatch(/\} catch \(error\) \{[\s\S]{0,200}releaseBackgroundMarks\(\);[\s\S]{0,60}throw error;/);
    });
});
