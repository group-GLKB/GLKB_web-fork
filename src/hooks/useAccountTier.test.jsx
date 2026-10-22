import { act, renderHook, waitFor } from '@testing-library/react';
import useAccountTier from './useAccountTier';
import { getMyTier } from '../service/Tier';

jest.mock('../service/Tier', () => ({ getMyTier: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it('shares the live plan and upgrade refresh between sidebar and settings', async () => {
    getMyTier.mockResolvedValue({ success: true, data: { tier: 'pro' } });
    const user = { id: 1, tier: 'free' };
    const { result } = renderHook(() => [useAccountTier(user), useAccountTier(user)]);
    await waitFor(() => expect(result.current[0].tierInfo?.tier).toBe('pro'));
    expect(result.current[1].tierInfo.tier).toBe('pro');
    expect(getMyTier).toHaveBeenCalledTimes(1);
    getMyTier.mockResolvedValue({ success: true, data: { tier: 'admin' } });
    await act(async () => { await result.current[1].refreshTierInfo(); });
    expect(result.current[0].tierInfo.tier).toBe('admin');
    expect(result.current[1].tierInfo.tier).toBe('admin');
});

it('does not expose the previous account or accept its late response after switching', async () => {
    let resolveOld;
    getMyTier.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
        .mockResolvedValue({ success: true, data: { tier: 'free' } });
    const { result, rerender } = renderHook(({ user }) => useAccountTier(user), { initialProps: { user: { id: 2 } } });
    rerender({ user: { id: 3 } });
    await waitFor(() => expect(result.current.tierInfo?.tier).toBe('free'));
    await act(async () => { resolveOld({ success: true, data: { tier: 'admin' } }); });
    expect(result.current.tierInfo.tier).toBe('free');
    rerender({ user: null });
    expect(result.current.tierInfo).toBeNull();
});

it('does not assume Free on failure and refreshes on window focus', async () => {
    getMyTier.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useAccountTier({ id: 4, tier: 'free' }));
    await act(async () => {});
    expect(result.current.tierInfo).toBeNull();
    getMyTier.mockResolvedValue({ success: true, data: { tier: 'pro' } });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.tierInfo.tier).toBe('pro');
});

it('refreshes after an upgrade even when the pre-upgrade read is still pending', async () => {
    let resolveOld;
    getMyTier.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
        .mockResolvedValue({ success: true, data: { tier: 'pro' } });
    const { result } = renderHook(() => useAccountTier({ id: 5 }));
    await act(async () => {
        const upgraded = result.current.refreshTierInfo();
        resolveOld({ success: true, data: { tier: 'free' } });
        await upgraded;
    });
    expect(getMyTier).toHaveBeenCalledTimes(2);
    expect(result.current.tierInfo.tier).toBe('pro');
});
