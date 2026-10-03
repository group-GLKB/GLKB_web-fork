/**
 * The composer's service-tier picker (Standard / Premium).
 *
 * Pinned here:
 *   * the tiers and prices come from `/credits/pricing`, only `enabled` rows are offered, and each
 *     row shows its price for the pipeline it would run on;
 *   * a resolved default is reported (so the request names a tier) but the picker never calls
 *     `onChange` for it — `onChange` is what the parents remember;
 *   * a guest is held to Standard: Premium is listed (so they can see what signing in unlocks)
 *     but choosing it asks them to sign in and does NOT select it.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TierPicker from '.';
import { fetchTierPricing, parsePricing } from '../../../service/serviceTiers';

jest.mock('../../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
// Only the network call is faked; `tiersFor` and the labels are the shipped ones.
jest.mock('../../../service/serviceTiers', () => ({
    ...jest.requireActual('../../../service/serviceTiers'),
    fetchTierPricing: jest.fn(),
}));

const PRICING = parsePricing({
    default_service_tier: 'standard',
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'advanced', credits: 5, enabled: false },
        { pipeline: 'chat', service_tier: 'premium', credits: 10, enabled: true },
        { pipeline: 'deep_research', service_tier: 'standard', credits: 20, enabled: true },
        { pipeline: 'deep_research', service_tier: 'premium', credits: 45, enabled: true },
    ],
});

beforeEach(() => {
    fetchTierPricing.mockReset();
    fetchTierPricing.mockResolvedValue(PRICING);
});

const setup = (props = {}) => {
    const onChange = jest.fn();
    const onResolveDefault = jest.fn();
    const onRequireSignIn = jest.fn();
    const view = render(
        <TierPicker
            onChange={onChange}
            onResolveDefault={onResolveDefault}
            onRequireSignIn={onRequireSignIn}
            {...props}
        />,
    );
    return { onChange, onResolveDefault, onRequireSignIn, view };
};

const open = async (name = /Service tier/) => {
    fireEvent.click(await screen.findByRole('button', { name }));
    return screen.getByRole('listbox', { name: 'Service tier' });
};

describe('what it offers', () => {
    it('lists the enabled tiers, most capable first, and hides Advanced', async () => {
        setup({ value: 'standard' });
        const list = await open();
        const options = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent);
        expect(options).toHaveLength(2);
        expect(options[0]).toMatch(/^Premium/);
        expect(options[1]).toMatch(/^Standard/);
        expect(list).not.toHaveTextContent('Advanced');
    });

    it("prices each row for the pipeline it would run on", async () => {
        setup({ value: 'standard' });
        const chat = await open();
        expect(chat).toHaveTextContent('10 credits/query');
        expect(chat).toHaveTextContent('1 credit/query');
    });

    it('prices Investigate at its own rates', async () => {
        setup({ value: 'standard', pipeline: 'deep_research' });
        const list = await open();
        expect(list).toHaveTextContent('45 credits/query');
        expect(list).toHaveTextContent('20 credits/query');
    });

    it('never names a model', async () => {
        setup({ value: 'premium' });
        const list = await open(/Premium/);
        expect(list.textContent).not.toMatch(/GPT|Sol|Luna/);
    });
});

describe('the value', () => {
    it('reports the default tier when it holds none, without remembering it', async () => {
        const { onChange, onResolveDefault } = setup({ value: '' });
        await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('standard'));
        expect(onResolveDefault).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('replaces a tier the deployment no longer offers', async () => {
        const { onResolveDefault } = setup({ value: 'advanced' });
        await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('standard'));
    });

    it('a pick is a change', async () => {
        const { onChange } = setup({ value: 'standard' });
        await open();
        fireEvent.click(screen.getByRole('option', { name: /Premium/ }));
        expect(onChange).toHaveBeenCalledWith('premium');
    });

    it('shows the tier on the chip', async () => {
        setup({ value: 'premium' });
        expect(await screen.findByRole('button', { name: 'Service tier: Premium' })).toHaveTextContent('Premium');
    });
});

describe('a guest', () => {
    it('is shown Standard even when Premium was stored', async () => {
        const { onResolveDefault } = setup({ value: 'premium', isGuest: true });
        expect(await screen.findByRole('button', { name: 'Service tier: Standard' })).toBeInTheDocument();
        await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('standard'));
    });

    it('sees Premium, marked as needing sign-in, and choosing it asks them to sign in', async () => {
        const { onChange, onRequireSignIn } = setup({ value: 'standard', isGuest: true });
        const list = await open();
        const premium = screen.getByRole('option', { name: /Premium/ });
        expect(premium).toHaveTextContent('Sign in');
        expect(list).toBeInTheDocument();
        fireEvent.click(premium);
        expect(onRequireSignIn).toHaveBeenCalledWith(expect.objectContaining({ id: 'premium' }));
        expect(onChange).not.toHaveBeenCalled();
    });
});

it('falls back to built-in prices when the endpoint cannot be read', async () => {
    fetchTierPricing.mockImplementation(jest.requireActual('../../../service/serviceTiers').fetchTierPricing);
    jest.spyOn(require('../../../utils/axiosConfig').default, 'get').mockRejectedValueOnce(new Error('offline'));
    setup({ value: 'standard' });
    const list = await open();
    expect(list).toHaveTextContent('Premium');
    expect(list).toHaveTextContent('10 credits/query');
});
