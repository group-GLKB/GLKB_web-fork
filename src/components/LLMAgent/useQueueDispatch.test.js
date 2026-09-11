import { useEffect, useRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useQueueDispatch } from './useQueueDispatch';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

it('wakes the next prompt when completion releases the lock after the last idle render', async () => {
    const first = deferred();
    const submit = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    renderHook(() => {
        const { revision, isDispatching, dispatch } = useQueueDispatch();
        const remaining = useRef(2);
        useEffect(() => {
            if (!remaining.current || isDispatching('a')) return;
            remaining.current -= 1;
            dispatch('a', submit);
        }, [revision, dispatch, isDispatching]);
    });
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
});

it('lets another conversation dispatch while suppressing duplicate dispatches in the same one', async () => {
    const first = deferred();
    const duplicate = jest.fn();
    const other = jest.fn();
    const { result } = renderHook(useQueueDispatch);
    let pending;
    await act(async () => {
        pending = result.current.dispatch('a', () => first.promise);
        await result.current.dispatch('a', duplicate);
        await result.current.dispatch('b', other);
    });
    expect(duplicate).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
    expect(result.current.isDispatching('a')).toBe(true);
    await act(async () => { first.resolve(); await pending; });
    expect(result.current.isDispatching('a')).toBe(false);
});

it('releases and notifies when a submit throws', async () => {
    const { result } = renderHook(useQueueDispatch);
    await act(async () => {
        await expect(result.current.dispatch('a', () => { throw new Error('failed'); }))
            .rejects.toThrow('failed');
    });
    expect(result.current.isDispatching('a')).toBe(false);
    expect(result.current.revision).toBe(1);
});
