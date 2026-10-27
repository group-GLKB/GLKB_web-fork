import { useCallback, useEffect, useState } from 'react';
import { getMyTier } from '../service/Tier';

// Share the server's account plan, not the cached login payload or the model tier.
const accounts = new Map();
const entryFor = (key) => {
    if (!accounts.has(key)) accounts.set(key, { data: null, listeners: new Set(), pending: null });
    return accounts.get(key);
};
const refresh = (entry) => {
    if (entry.pending) return entry.pending;
    entry.pending = getMyTier().then((result) => {
        if (result.success) {
            entry.data = result.data || null;
            entry.listeners.forEach(listener => listener(entry.data));
        }
        return result;
    }).finally(() => { entry.pending = null; });
    return entry.pending;
};

export default function useAccountTier(user) {
    const key = user ? String(user.id ?? user.uid ?? user.email ?? user.username ?? '') : '';
    const [snapshot, setSnapshot] = useState({ key: '', data: null });
    useEffect(() => {
        if (!key) return undefined;
        const entry = entryFor(key);
        const update = data => setSnapshot({ key, data });
        entry.listeners.add(update);
        update(entry.data);
        const reload = () => { refresh(entry).catch(() => {}); };
        reload();
        window.addEventListener('focus', reload);
        return () => {
            window.removeEventListener('focus', reload);
            entry.listeners.delete(update);
            if (!entry.listeners.size) accounts.delete(key);
        };
    }, [key]);
    const refreshTierInfo = useCallback(async () => {
        if (!key) return null;
        const entry = entryFor(key);
        // An upgrade must read after the mutation, even if an older read was in flight.
        if (entry.pending) await entry.pending;
        return refresh(entry);
    }, [key]);
    return { tierInfo: snapshot.key === key ? snapshot.data : null, refreshTierInfo };
}
