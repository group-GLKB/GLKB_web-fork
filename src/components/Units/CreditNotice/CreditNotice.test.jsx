import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { affordableChoice, creditNotice, parseCredits } from '../../../service/credits';
import { parsePricing, FALLBACK_PRICING, tierLabel } from '../../../service/serviceTiers';
import CreditNotice, { CreditDialog, noticeFor } from '.';

jest.mock('../../../utils/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));

const pricing = parsePricing(FALLBACK_PRICING);
// The account the 2026-11-02 report came from: free tier, 10 of 100 left, resetting Dec 1.
const usage = (remaining, extra = {}) => parseCredits({
    remaining,
    monthly_allowance: 100,
    monthly_remaining: remaining,
    resets_at: '2026-12-01T00:00:00',
    ...extra,
});

describe('the composer credit notice', () => {
    it('says an Investigate run costs more than is left, when it comes back, and what still works', () => {
        const notice = noticeFor(usage(10), pricing, 'deep_research', 'advanced');
        expect(notice.level).toBe('short');
        expect(notice.text).toBe(
            'An Investigate run on GPT-6.1 Terra costs 30 credits and you have 10 left.'
            + ' Your free monthly credits come back on Dec 1.'
            + ' AI Chat on GPT-6.1 Terra (5 credits) still works.',
        );
    });

    it('offers a cheaper model on the same mode when one fits', () => {
        const notice = noticeFor(usage(25), pricing, 'deep_research', 'advanced');
        expect(notice.level).toBe('short');
        expect(notice.text).toContain('Switch to GPT-6 Luna (20 credits) to go ahead now.');
    });

    it('warns quietly once a fifth of the month is left, while the question still fits', () => {
        const notice = noticeFor(usage(10), pricing, 'chat', 'advanced');
        expect(notice).toMatchObject({
            level: 'low',
            text: '10 credits left this month. Your free monthly credits come back on Dec 1.',
        });
        expect(noticeFor(usage(20), pricing, 'chat', 'standard').level).toBe('low');
        expect(noticeFor(usage(21), pricing, 'chat', 'standard')).toBeNull();
    });

    it('prices an unset tier at the default the backend would use', () => {
        expect(noticeFor(usage(10), pricing, 'deep_research', '').text).toContain('on GPT-6.1 Terra costs 30');
    });

    it('says nothing for a guest, an unknown balance or an empty one (that has its own notice)', () => {
        expect(creditNotice({ kind: 'guest', remaining: 1, limit: 10 }, { cost: 5 })).toBeNull();
        expect(creditNotice(usage(null), { cost: 5 })).toBeNull();
        expect(creditNotice(usage(0), { cost: 5 })).toBeNull();
        expect(noticeFor(null, pricing, 'chat', 'advanced')).toBeNull();
    });

    it('does not warn low on a balance with no monthly allowance to measure against', () => {
        expect(creditNotice(usage(3, { monthly_allowance: null }), { cost: 1 })).toBeNull();
    });

    it('stays quiet about cost while the prices have not arrived', () => {
        expect(noticeFor(usage(10), null, 'deep_research', 'advanced').level).toBe('low');
    });

    it("suggests AI Chat on the reader's own model rather than a dearer one", () => {
        // Sol's chat (10) fits 10 credits too, but Terra is what they picked.
        expect(affordableChoice(pricing, 'deep_research', 10, 'advanced'))
            .toEqual({ tierId: 'advanced', pipeline: 'chat', credits: 5 });
        expect(affordableChoice(pricing, 'deep_research', 3, 'advanced'))
            .toEqual({ tierId: 'standard', pipeline: 'chat', credits: 1 });
    });

    it('finds nothing affordable when even the cheapest chat does not fit', () => {
        expect(affordableChoice(pricing, 'deep_research', 0.5)).toBeNull();
        expect(tierLabel('standard')).toBe('GPT-6 Luna');
    });

    it('renders the line, and nothing without a notice', () => {
        const { container, rerender } = render(<CreditNotice notice={null} />);
        expect(container.innerHTML).toBe('');
        rerender(<CreditNotice notice={{ level: 'low', text: '10 credits left this month.' }} />);
        expect(screen.getByRole('status').textContent).toBe('10 credits left this month.');
        expect(screen.getByRole('status').className).toContain('credit-float-low');
        rerender(<CreditNotice notice={null} />);
    });
});

describe('the few words it shows', () => {
    it('keeps the floating notice short; the whole sentence is its tooltip and the pop-up', () => {
        expect(noticeFor(usage(10), pricing, 'chat', 'advanced').brief).toBe('10 credits left · resets Dec 1');
        expect(noticeFor(usage(10), pricing, 'deep_research', 'advanced').brief)
            .toBe('Investigate needs 30 credits · 10 left');
        const notice = noticeFor(usage(10), pricing, 'deep_research', 'advanced');
        render(<CreditNotice notice={notice} />);
        expect(screen.getByRole('status').textContent).toBe('Investigate needs 30 credits · 10 left');
        expect(screen.getByTitle(notice.text)).toBeTruthy();
    });

    it("draws the home page's as the news strip is, tag and all", () => {
        sessionStorage.clear();
        render(<CreditNotice variant="strip" notice={noticeFor(usage(10), pricing, 'deep_research', 'advanced')} />);
        const strip = screen.getByRole('status');
        // Amber when it cannot be paid for, as the chat page's (not the news' brand blue).
        expect(strip.className).toContain('is-short');
        expect(strip.querySelector('.news-strip .news-strip-tag').textContent).toBe('Credits');
        expect(strip.querySelector('.news-strip-text').textContent).toBe('Investigate needs 30 credits · 10 left');
        expect(strip.querySelector('.news-strip-close')).toBeTruthy();
    });
});

describe('closing the notice', () => {
    beforeEach(() => sessionStorage.clear());
    const low = { level: 'low', text: '10 credits left this month.' };

    it('hides it, in every composer, until it says something else', () => {
        const { rerender } = render(<><CreditNotice notice={low} /><CreditNotice notice={low} /></>);
        expect(screen.getAllByRole('status')).toHaveLength(2);
        fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
        expect(screen.queryByRole('status')).toBeNull();
        // Another answer spent credits: a new number, so it is back.
        rerender(<><CreditNotice notice={{ level: 'low', text: '5 credits left this month.' }} /></>);
        expect(screen.getByRole('status').textContent).toBe('5 credits left this month.');
    });

    it('stays closed for the session', () => {
        render(<CreditNotice notice={low} />);
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        const { container } = render(<CreditNotice notice={low} />);
        expect(container.innerHTML).toBe('');
    });
});

describe('the "Not enough credits" pop-up', () => {
    it('shows the reason and closes on OK', () => {
        const onClose = jest.fn();
        render(<CreditDialog notice={{ level: 'short', text: 'An Investigate run costs 30 credits.' }} onClose={onClose} />);
        expect(screen.getByRole('dialog').textContent).toContain('Not enough credits');
        expect(screen.getByRole('dialog').textContent).toContain('An Investigate run costs 30 credits.');
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('is closed without a notice', () => {
        render(<CreditDialog notice={null} onClose={() => {}} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
