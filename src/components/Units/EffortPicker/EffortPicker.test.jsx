/**
 * The effort submenu (Units/EffortPicker): which levels can be picked, and who has to sign in
 * for which (service/effortLevels.js; the three-repo effort contract, 2026-11-05).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/* eslint-disable import/first */
jest.mock('../../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

import { chooseEffort, EffortLevels } from '.';
import { effortLevel, setServerEfforts } from '../../../service/effortLevels';
import { parsePricing, tierCreditsForEffort } from '../../../service/serviceTiers';
import { GUEST_HIGH_REASON, GUEST_INVESTIGATE_REASON, guestEffortReason } from '../../../utils/refusals';
/* eslint-enable import/first */

const RAW = {
    default_service_tier: 'advanced',
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'advanced', credits: 5, enabled: true },
        { pipeline: 'deep_research', service_tier: 'advanced', credits: 30, enabled: true },
    ],
    efforts: [
        { id: 'low', pipeline: 'chat', enabled: true, guest: true, default: false, prices: { standard: 1, advanced: 2, premium: 5 } },
        { id: 'medium', pipeline: 'chat', enabled: true, guest: true, default: true, prices: { standard: 1, advanced: 5, premium: 10 } },
        { id: 'high', pipeline: 'chat', enabled: true, guest: false, default: false, prices: { standard: 3, advanced: 10, premium: 20 } },
        { id: 'extra', pipeline: 'deep_research', enabled: true, guest: false, default: true, prices: { standard: 20, advanced: 30, premium: 45 } },
        { id: 'max', pipeline: 'deep_research', enabled: true, guest: false, default: false, prices: { standard: 40, advanced: 60, premium: 90 } },
    ],
};

const row = (name) => screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) });

afterEach(() => setServerEfforts(null));

describe('without the backend\'s levels (dev before its deploy, or glkb.org)', () => {
    it('offers Medium and Extra; Low, High and Max are listed, greyed out', () => {
        render(<EffortLevels effort="medium" onPick={() => {}} />);
        expect(row('Medium')).toHaveAttribute('aria-disabled', 'false');
        expect(row('Extra')).toHaveAttribute('aria-disabled', 'false');
        ['Low', 'High', 'Max'].forEach((name) => expect(row(name)).toHaveAttribute('aria-disabled', 'true'));
        expect(row('Low')).toHaveTextContent('~15 s');
    });

    it('does nothing on a level not offered', () => {
        const onEffortChange = jest.fn();
        chooseEffort({ level: effortLevel('high'), effort: 'medium', isGuest: false, onEffortChange });
        expect(onEffortChange).not.toHaveBeenCalled();
    });
});

describe('with them', () => {
    beforeEach(() => { setServerEfforts(parsePricing(RAW).efforts); });

    it('offers all five', () => {
        const onPick = jest.fn();
        render(<EffortLevels effort="medium" onPick={onPick} />);
        ['Low', 'Medium', 'High', 'Extra', 'Max'].forEach((name) => expect(row(name)).toHaveAttribute('aria-disabled', 'false'));
        fireEvent.click(row('High'));
        expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'high' }));
    });

    it('marks High, Extra and Max "Sign in" for a guest, and not Low', () => {
        render(<EffortLevels effort="medium" isGuest onPick={() => {}} />);
        ['High', 'Extra', 'Max'].forEach((name) => expect(row(name)).toHaveTextContent('Sign in'));
        expect(row('Low')).not.toHaveTextContent('Sign in');
    });

    it('asks a guest who picks High to sign in, with High\'s own reason', () => {
        const onEffortChange = jest.fn();
        const onRequireSignIn = jest.fn();
        chooseEffort({ level: effortLevel('high'), effort: 'medium', isGuest: true, onEffortChange, onRequireSignIn });
        expect(onEffortChange).not.toHaveBeenCalled();
        expect(onRequireSignIn).toHaveBeenCalledWith('effort', expect.objectContaining({ id: 'high' }));
        expect(guestEffortReason(onRequireSignIn.mock.calls[0][1])).toBe(GUEST_HIGH_REASON);
        expect(GUEST_HIGH_REASON).toMatch(/^High effort is available to signed-in users/);
        expect(guestEffortReason('extra')).toBe(GUEST_INVESTIGATE_REASON);
    });

    it('lets a guest pick Low, and a signed-in reader High', () => {
        const onEffortChange = jest.fn();
        chooseEffort({ level: effortLevel('low'), effort: 'medium', isGuest: true, onEffortChange });
        chooseEffort({ level: effortLevel('high'), effort: 'medium', isGuest: false, onEffortChange });
        expect(onEffortChange.mock.calls).toEqual([['low'], ['high']]);
    });

    it('prices each model row at the chosen level', () => {
        const advanced = parsePricing(RAW).tiers.find((t) => t.id === 'advanced');
        expect(tierCreditsForEffort(advanced, 'high')).toBe(10);
        expect(tierCreditsForEffort(advanced, 'medium')).toBe(5);
        expect(tierCreditsForEffort(advanced, 'max')).toBe(60);
    });
});
