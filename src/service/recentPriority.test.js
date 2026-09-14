import { getRecentPriorityIds, holdRecentPriority, subscribeToRecentPriority } from './recentPriority';
import { clearActiveRun, isConversationRunning, setActiveRun } from './activeRun';

it('keeps Recent priority during a slow refresh without blocking another turn', async () => {
    let resolve;
    const refresh = new Promise((done) => { resolve = done; });
    const listener = jest.fn();
    const unsubscribe = subscribeToRecentPriority(listener);
    setActiveRun({ conversationId: 'a', kind: 'chat', key: 'first' });
    holdRecentPriority('a', refresh);
    clearActiveRun('a');
    expect(isConversationRunning('a')).toBe(false);
    expect(getRecentPriorityIds().has('a')).toBe(true);
    setActiveRun({ conversationId: 'a', kind: 'chat', key: 'next' });
    resolve();
    await refresh;
    expect(getRecentPriorityIds().has('a')).toBe(false);
    expect(isConversationRunning('a')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    clearActiveRun('a');
});

it('an old refresh cannot remove a newer priority hold, including on failure', async () => {
    let finishOld;
    let failNew;
    const old = new Promise((resolve) => { finishOld = resolve; });
    const newer = new Promise((_, reject) => { failNew = reject; });
    holdRecentPriority('b', old);
    holdRecentPriority('b', newer);
    finishOld();
    await old;
    expect(getRecentPriorityIds().has('b')).toBe(true);
    failNew(new Error('list request failed'));
    await newer.catch(() => {});
    expect(getRecentPriorityIds().has('b')).toBe(false);
});
