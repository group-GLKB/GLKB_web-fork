/**
 * The composer's service-tier picker (standard / premium, shown as GPT-6 Luna / GPT-6.1 Sol).
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

const open = async (name = /^Model: /) => {
    fireEvent.click(await screen.findByRole('button', { name }));
    return screen.getByRole('listbox', { name: 'Model' });
};

describe('what it offers', () => {
    it('lists the enabled tiers, most capable first, and hides Advanced', async () => {
        setup({ value: 'standard' });
        const list = await open();
        const options = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent);
        expect(options).toHaveLength(2);
        expect(options[0]).toMatch(/^GPT-6.1 Sol/);
        expect(options[1]).toMatch(/^GPT-6 Luna/);
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

    it('names each tier by its model, never by the tier', async () => {
        setup({ value: 'premium' });
        const list = await open(/GPT-6.1 Sol/);
        expect(list).toHaveTextContent('GPT-6.1 Sol');
        expect(list).toHaveTextContent('GPT-6 Luna');
        expect(list.textContent).not.toMatch(/Standard|Premium/);
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
        fireEvent.click(screen.getByRole('option', { name: /GPT-6.1 Sol/ }));
        expect(onChange).toHaveBeenCalledWith('premium');
    });

    it("shows the tier's model on the chip", async () => {
        setup({ value: 'premium' });
        expect(await screen.findByRole('button', { name: 'Model: GPT-6.1 Sol' })).toHaveTextContent('GPT-6.1 Sol');
    });
});

describe('a guest', () => {
    it('is shown GPT-6 Luna (standard) even when premium was stored', async () => {
        const { onResolveDefault } = setup({ value: 'premium', isGuest: true });
        expect(await screen.findByRole('button', { name: 'Model: GPT-6 Luna' })).toBeInTheDocument();
        await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('standard'));
    });

    it('sees GPT-6.1 Sol, marked as needing sign-in, and choosing it asks them to sign in', async () => {
        const { onChange, onRequireSignIn } = setup({ value: 'standard', isGuest: true });
        const list = await open();
        const premium = screen.getByRole('option', { name: /GPT-6.1 Sol/ });
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
    expect(list).toHaveTextContent('GPT-6.1 Sol');
    expect(list).toHaveTextContent('10 credits/query');
});
