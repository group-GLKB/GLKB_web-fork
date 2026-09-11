import { useCallback, useRef, useState } from 'react';

// Claim synchronously, then notify React after release even if no run state changed.
export const useQueueDispatch = () => {
    const pending = useRef(new Set());
    const [revision, setRevision] = useState(0);
    const isDispatching = useCallback((key) => pending.current.has(key), []);
    const dispatch = useCallback((key, submit) => {
        if (pending.current.has(key)) return Promise.resolve();
        pending.current.add(key);
        return Promise.resolve().then(submit).finally(() => {
            pending.current.delete(key);
            setRevision((value) => value + 1);
        });
    }, []);
    return { revision, isDispatching, dispatch };
};
