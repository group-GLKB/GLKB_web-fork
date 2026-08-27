import { makeDrip, DRIP_CATCHUP_DIVISOR } from './streamDrip';

/**
 * A hand-cranked frame loop. The drip is pure apart from its scheduler and clock, so injecting
 * both makes every assertion here deterministic — no timers, no rAF, no waiting.
 */
const harness = ({ text = '' } = {}) => {
    const shown = [];
    let full = text;
    let clock = 0;
    let nextId = 1;
    const queue = new Map();

    const drip = makeDrip({
        getFull: () => full,
        show: (value) => shown.push(value),
        schedule: (fn) => { const id = nextId++; queue.set(id, fn); return id; },
        cancel: (id) => queue.delete(id),
        now: () => clock,
    });

    return {
        drip,
        shown,
        last: () => shown[shown.length - 1],
        write: (more) => { full += more; },
        replace: (value) => { full = value; },
        /** Run one queued frame, advancing the clock past the interval gate by default. */
        frame: (advanceMs = 40) => {
            clock += advanceMs;
            const [id, fn] = queue.entries().next().value || [];
            if (fn) { queue.delete(id); fn(); }
        },
        frames: (count, advanceMs) => {
            for (let i = 0; i < count; i += 1) {
                clock += advanceMs === undefined ? 40 : advanceMs;
                const [id, fn] = queue.entries().next().value || [];
                if (fn) { queue.delete(id); fn(); }
            }
        },
        pending: () => queue.size,
    };
};

describe('makeDrip', () => {
    it('reveals the text a piece at a time rather than all at once', () => {
        const h = harness({ text: 'a'.repeat(120) });
        h.drip.start();
        h.frame();
        expect(h.last().length).toBeGreaterThan(0);
        expect(h.last().length).toBeLessThan(120);
    });

    it('always shows a prefix of the buffer, never reordered or overshot', () => {
        const full = 'The BRCA1 gene is associated with breast cancer risk.';
        const h = harness({ text: full });
        h.drip.start();
        h.frames(20);
        h.shown.forEach((value) => expect(full.startsWith(value)).toBe(true));
        expect(h.last()).toBe(full);
    });

    it('closes most of the gap in the first few steps', () => {
        // The step is proportional to the backlog, so a burst lands fast and then eases in
        // rather than arriving at a constant crawl.
        const h = harness({ text: 'x'.repeat(5000) });
        h.drip.start();
        h.frames(DRIP_CATCHUP_DIVISOR);
        expect(h.last().length).toBeGreaterThan(5000 * 0.6);
        expect(h.last().length).toBeLessThan(5000);
    });

    it('reaches the end of a long buffer rather than converging toward it', () => {
        // The proportional step alone would halve its way to the end forever; the minChars floor
        // is what terminates it. 5000 characters finish well inside this many frames.
        const h = harness({ text: 'x'.repeat(5000) });
        h.drip.start();
        h.frames(60);
        expect(h.last()).toHaveLength(5000);
        expect(h.pending()).toBe(0);
    });

    it('a burst mid-drip is caught up, not merely chased', () => {
        const h = harness({ text: 'x'.repeat(120) });
        h.drip.start();
        h.frames(3);
        const behindEarly = 120 - h.last().length;
        expect(behindEarly).toBeGreaterThan(0);
        h.write('y'.repeat(4000));           // a burst lands mid-drip
        h.frames(60);
        expect(h.last()).toHaveLength(4120);
    });

    it('never falls further behind than it already was', () => {
        const h = harness({ text: 'x'.repeat(2000) });
        h.drip.start();
        let previousGap = Infinity;
        for (let i = 0; i < 40; i += 1) {
            h.frame();
            const gap = 2000 - (h.last() || '').length;
            expect(gap).toBeLessThan(previousGap);
            previousGap = gap;
            if (gap === 0) break;
        }
        expect(previousGap).toBe(0);
    });

    it('holds still inside one interval, so a frame costs at most one repaint', () => {
        const h = harness({ text: 'x'.repeat(500) });
        h.drip.start();
        h.frame(40);
        const after = h.shown.length;
        h.frame(1);                          // same interval — gated
        expect(h.shown).toHaveLength(after);
        h.frame(40);                         // next interval — repaints
        expect(h.shown.length).toBeGreaterThan(after);
    });

    it('runs one loop however many times it is started', () => {
        const h = harness({ text: 'x'.repeat(500) });
        h.drip.start();
        h.drip.start();
        h.drip.start();
        expect(h.pending()).toBe(1);
    });

    it('stops scheduling once the buffer is exhausted', () => {
        const h = harness({ text: 'short' });
        h.drip.start();
        h.frames(4);
        expect(h.last()).toBe('short');
        expect(h.pending()).toBe(0);
    });

    it('flush shows everything at once and leaves nothing queued', () => {
        const full = 'x'.repeat(3000);
        const h = harness({ text: full });
        h.drip.start();
        h.frame();
        h.drip.flush(full);
        expect(h.last()).toBe(full);
        expect(h.pending()).toBe(0);
        expect(h.drip.isRunning()).toBe(false);
    });

    it('flush after a stop still shows the whole text', () => {
        const h = harness({ text: 'partial answer' });
        h.drip.start();
        h.frame();
        h.drip.stop();
        h.drip.flush('the authoritative answer');
        expect(h.last()).toBe('the authoritative answer');
    });

    it('reset restarts the cursor when a new block replaces the buffer', () => {
        // A tool call ends the block: what streamed before it was the model narrating its way to
        // the call, and the client keeps only the newest block. The cursor has to go back with it,
        // or the new block's opening characters are skipped.
        const h = harness({ text: 'I will search PubMed for BRCA1 evidence.' });
        h.drip.start();
        h.frames(20);
        expect(h.last()).toBe('I will search PubMed for BRCA1 evidence.');

        h.replace('BRCA1 encodes');
        h.drip.reset();
        h.drip.start();
        h.frames(20);
        expect(h.last()).toBe('BRCA1 encodes');
        // The cursor restarted, so the first paint of the new block is its opening characters —
        // not a continuation from wherever the previous block had got to.
        const afterReset = h.shown.slice(h.shown.indexOf('BRCA1 encodes'.slice(0, 12)));
        expect(afterReset[0]).toBe('BRCA1 encode');
    });

    it('stop leaves the cursor where it is and paints nothing further', () => {
        const h = harness({ text: 'x'.repeat(1000) });
        h.drip.start();
        h.frame();
        const frozen = h.last();
        h.drip.stop();
        h.frames(5);
        expect(h.last()).toBe(frozen);
        expect(h.drip.isRunning()).toBe(false);
    });

    it('does nothing when there is no text yet', () => {
        const h = harness({ text: '' });
        h.drip.start();
        h.frames(3);
        expect(h.shown).toHaveLength(0);
    });
});
