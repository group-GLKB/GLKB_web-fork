/**
 * "Ask in Investigate" under a chat answer whose search the agent cut short.
 *
 * Pinned here:
 *   * the agent's `search_limit` ("context" | "calls") reaches the message, live AND from a
 *     reloaded answer's stored trace, and any other value is ignored;
 *   * the notice is for chat answers only — never an Investigate one;
 *   * the button names its price the way the app prices Investigate elsewhere, and a guest
 *     (who is asked to sign in instead) is shown none;
 *   * the question asked again is the reader's own text for that turn, without its files, and it
 *     is handed over the way the home composer's Investigate tab hands one over.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchLimitNotice, { investigatePriceText, SEARCH_LIMIT_TEXT } from './SearchLimitNotice';
import {
    investigateAttachmentsFor,
    investigateHandoffState,
    investigateQuestionFor,
    showsSearchLimit,
} from './searchLimit';
import { replayTrace } from './traceReplay';
import { frameToUpdate, searchLimitOf } from '../../service/LLMAgent';
import { fetchTierPricing, parsePricing } from '../../service/serviceTiers';

jest.mock('../../service/serviceTiers', () => ({
    ...jest.requireActual('../../service/serviceTiers'),
    fetchTierPricing: jest.fn(),
}));

const PRICING = parsePricing({
    default_service_tier: 'advanced',
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'advanced', credits: 5, enabled: true },
        { pipeline: 'deep_research', service_tier: 'standard', credits: 20, enabled: true },
        { pipeline: 'deep_research', service_tier: 'advanced', credits: 30, enabled: true },
        { pipeline: 'deep_research', service_tier: 'premium', credits: 45, enabled: true },
    ],
});

beforeEach(() => {
    fetchTierPricing.mockReset();
    fetchTierPricing.mockResolvedValue(PRICING);
});

describe('the search_limit flag', () => {
    it('is read off the Complete frame: "context" or "calls", nothing else', () => {
        expect(frameToUpdate({ step: 'Complete', response: 'a', search_limit: 'context' }).searchLimit)
            .toBe('context');
        expect(frameToUpdate({ step: 'Complete', response: 'a', search_limit: 'calls' }).searchLimit)
            .toBe('calls');
        expect(frameToUpdate({ step: 'Complete', response: 'a' }).searchLimit).toBeNull();
        expect(frameToUpdate({ step: 'Complete', response: 'a', search_limit: 'other' }).searchLimit)
            .toBeNull();
        expect(searchLimitOf(true)).toBeNull();
    });

    it('survives a reload: the stored trace keeps it on its Complete stub', () => {
        const trace = {
            v: 1, mode: 'chat', complete: true, duration_ms: 30000,
            frames: [
                { step: 'Processing', content: 'Searching' },
                { step: 'Complete', search_limit: 'context' },
            ],
        };
        expect(replayTrace(trace).searchLimit).toBe('context');
        expect(replayTrace({ ...trace, frames: [trace.frames[0], { step: 'Complete' }] }).searchLimit)
            .toBeUndefined();
    });

    it('marks chat answers only — never an Investigate answer', () => {
        expect(showsSearchLimit({ role: 'assistant', content: 'a', searchLimit: 'calls' })).toBe(true);
        expect(showsSearchLimit({ role: 'assistant', content: 'a', searchLimit: 'context', investigateMode: true }))
            .toBe(false);
        expect(showsSearchLimit({ role: 'assistant', content: 'a' })).toBe(false);
        expect(showsSearchLimit({ role: 'user', content: 'q', searchLimit: 'calls' })).toBe(false);
    });
});

describe('the notice', () => {
    it('says why, and asks in Investigate with one click, at the price of an Investigate run', async () => {
        const onAsk = jest.fn();
        render(<SearchLimitNotice reason="context" serviceTier="premium" onAsk={onAsk} />);
        expect(screen.getByRole('note')).toHaveTextContent(SEARCH_LIMIT_TEXT);
        const button = await screen.findByRole('button', { name: 'Ask in Investigate, 45 credits' });
        expect(button).toHaveTextContent('45 credits');
        fireEvent.click(button);
        expect(onAsk).toHaveBeenCalledTimes(1);
    });

    it('prices a reader with no tier picked at the default tier, which is what they are charged', async () => {
        render(<SearchLimitNotice reason="calls" serviceTier="" onAsk={jest.fn()} />);
        expect(await screen.findByRole('button', { name: 'Ask in Investigate, 30 credits' })).toBeInTheDocument();
    });

    it('shows no price to a guest, who is asked to sign in instead — and asks nothing of the network', () => {
        render(<SearchLimitNotice reason="calls" showPrice={false} onAsk={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Ask in Investigate' })).toBeInTheDocument();
        expect(fetchTierPricing).not.toHaveBeenCalled();
    });

    it('still offers the button before (or without) a price', () => {
        fetchTierPricing.mockReturnValue(new Promise(() => {}));
        render(<SearchLimitNotice reason="calls" onAsk={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Ask in Investigate' })).toBeInTheDocument();
    });

    it('formats the price as the rest of the app does', () => {
        expect(investigatePriceText(null, 'advanced')).toBe('');
        expect(investigatePriceText(PRICING, 'standard')).toBe('20 credits');
        expect(investigatePriceText(PRICING, 'nonexistent')).toBe('');
    });
});

describe('the question it asks again', () => {
    const history = [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
        {
            role: 'user',
            content: '  how does NR4A1 drive T-cell exhaustion?  ',
            attachments: [{ id: 'f1', name: 'paper.pdf' }],
        },
        { role: 'assistant', content: 'partial answer', searchLimit: 'context' },
    ];

    it("is the reader's own text for that turn, without its files", () => {
        expect(investigateQuestionFor(history, 3)).toBe('how does NR4A1 drive T-cell exhaustion?');
        expect(investigateQuestionFor(history, 1)).toBe('first question');
        expect(investigateQuestionFor(history, 0)).toBe('');
        expect(investigateQuestionFor(null, 3)).toBe('');
    });

    it('is handed over the way the home composer hands over an Investigate question', () => {
        const state = investigateHandoffState('how does NR4A1 drive T-cell exhaustion?', 'premium');
        expect(state).toEqual({
            initialQuery: 'how does NR4A1 drive T-cell exhaustion?',
            initialSearchOptions: {
                filters: [],
                rankingMode: 'default',
                investigateEnabled: true,
                serviceTier: 'premium',
            },
            initialQueryMethod: 'button',
        });
        // No attachments ride along: a chat turn's files stay with the chat they were sent in.
        expect(state.initialSearchOptions).not.toHaveProperty('attachments');
    });

    it("gives that turn's documents, without its images, for a re-ask in the same conversation", () => {
        const withImage = [
            {
                role: 'user',
                content: 'q',
                attachments: [{ id: 'f1', kind: 'pdf' }, { id: 'i1', kind: 'image' }, { id: 'n1', kind: 'file' }],
            },
            { role: 'assistant', content: 'a' },
        ];
        expect(investigateAttachmentsFor(withImage, 1).map((a) => a.id)).toEqual(['f1', 'n1']);
        expect(investigateAttachmentsFor(history, 1)).toEqual([]);
        expect(investigateAttachmentsFor(history, 0)).toEqual([]);
        expect(investigateAttachmentsFor(null, 3)).toEqual([]);
    });
});
