/**
 * The colour of a working conversation's dot: Investigate and Literature Review are purple,
 * chat is blue (components/Units/ConversationRunStatus). What decides it is `runKindOf`.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import ConversationRunStatus from '../components/Units/ConversationRunStatus';
import { clearActiveRun, forgetRun, reconcileRunsWithServer, runKindOf, setActiveRun } from './activeRun';

beforeEach(() => clearActiveRun());

describe('runKindOf', () => {
    it('is the run this tab started', () => {
        setActiveRun({ kind: 'investigate', runId: null, conversationId: '7' });
        expect(runKindOf({ id: '7' })).toBe('investigate');
        setActiveRun({ kind: 'chat', runId: null, conversationId: '8' });
        // A chat follow-up in a conversation that once investigated is a chat run.
        expect(runKindOf({ id: '8', isInvestigate: true })).toBe('chat');
    });

    it('is a literature review whenever the conversation is one', () => {
        expect(runKindOf({ id: '9', mode: 'literature_review' })).toBe('literature_review');
    });

    it('falls back to the conversation\'s own label for a run it does not hold', () => {
        expect(runKindOf({ id: '10', isInvestigate: true })).toBe('investigate');
        expect(runKindOf({ id: '11' })).toBe('chat');
        expect(runKindOf(null)).toBe('chat');
    });

    it('takes the kind from the server\'s list, a literature review included', () => {
        reconcileRunsWithServer([
            { id: '20', isAnswering: true, mode: 'literature_review' },
            { id: '21', isAnswering: true, isInvestigate: true },
            { id: '22', isAnswering: true },
        ]);
        expect(runKindOf({ id: '20' })).toBe('literature_review');
        expect(runKindOf({ id: '21' })).toBe('investigate');
        expect(runKindOf({ id: '22' })).toBe('chat');
        ['20', '21', '22'].forEach(forgetRun);
    });
});

describe('ConversationRunStatus', () => {
    it('is purple for Investigate and Literature Review, blue for chat', () => {
        const { rerender } = render(<ConversationRunStatus kind="investigate" />);
        expect(screen.getByLabelText('Investigation in progress').classList.contains('is-purple')).toBe(true);
        rerender(<ConversationRunStatus kind="literature_review" />);
        expect(screen.getByLabelText('Literature review in progress').classList.contains('is-purple')).toBe(true);
        rerender(<ConversationRunStatus kind="chat" />);
        expect(screen.getByLabelText('Conversation is loading').classList.contains('is-purple')).toBe(false);
        rerender(<ConversationRunStatus />);
        expect(screen.getByLabelText('Conversation is loading').classList.contains('is-purple')).toBe(false);
    });
});
