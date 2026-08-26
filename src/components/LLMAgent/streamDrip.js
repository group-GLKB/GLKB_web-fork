/**
 * Streaming cadence for the answer body.
 *
 * Its own module, with no imports: `components/LLMAgent/index.jsx` cannot be pulled into a test
 * without dragging the whole app in behind it.
 *
 * The agent does not forward the model's tokens one by one. Its DeltaBatcher coalesces them into
 * one `Delta` frame per ~120 characters, because every frame that crosses the SSE boundary costs
 * the client a markdown re-parse of the whole message — 444 raw events for 1861 characters would
 * trade a 10 s wait for 10 s of jank (see the agent's service/stream_delta.py).
 *
 * 120 characters is about a line of prose. Writing each frame straight into state is therefore
 * correct and still reads badly: a line appears, half a second passes, another line appears. The
 * answer arrives in lurches rather than flowing.
 *
 * The drip separates what the reader sees from what the network delivers. The full text
 * accumulates in the caller's buffer; this advances a cursor through it and shows the prefix.
 *
 * Each step closes a FRACTION of the gap rather than advancing a fixed number of characters.
 * That is what makes one loop serve both a slow model and a fast one: the further behind the
 * cursor is the harder it moves, so a 4 000-character burst is mostly on screen within a few
 * frames, while a trickle still advances by the `minChars` floor instead of stalling. The floor
 * is also what makes it terminate — a proportional step alone would approach the end and never
 * reach it.
 *
 * It never delays the end. `flush` shows everything at once, which is what the caller does on
 * the authoritative `Answer` frame: by then the reader has watched most of the text arrive, and
 * holding the tail back would be delay for its own sake.
 */

// ~30fps. A second repaint inside one frame buys the reader nothing and costs a markdown parse.
export const DRIP_INTERVAL_MS = 33;
// Each step closes this fraction of the gap between what is shown and what has arrived: a
// divisor of 8 means an eighth of the backlog per step, so ~2/3 of a burst lands in 8 steps
// (~0.26 s) and the rest follows without a jolt.
export const DRIP_CATCHUP_DIVISOR = 8;
// The floor the proportional step never goes below. It sets how fast the last stretch finishes
// — at 12 characters a step a 100-character tail takes ~9 frames — and it is why the cursor
// reaches the end at all rather than halving its way toward it forever.
export const DRIP_MIN_CHARS = 12;

const defaultSchedule = (fn) => (
    typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(fn)
        : setTimeout(fn, DRIP_INTERVAL_MS)
);

const defaultCancel = (id) => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
};

const defaultNow = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

/**
 * @param {object}   deps
 * @param {function} deps.getFull  Returns the whole text streamed so far.
 * @param {function} deps.show     Called with the prefix the reader should see.
 * @param {function} [deps.schedule] Frame scheduler; overridden in tests.
 * @param {function} [deps.cancel]   Frame canceller; overridden in tests.
 * @param {function} [deps.now]      Clock in ms; overridden in tests.
 * @param {number}   [deps.catchupDivisor] Fraction of the gap closed per step.
 * @param {number}   [deps.minChars]       Floor on the step, and what makes it terminate.
 */
export const makeDrip = ({
    getFull,
    show,
    schedule = defaultSchedule,
    cancel = defaultCancel,
    now = defaultNow,
    intervalMs = DRIP_INTERVAL_MS,
    catchupDivisor = DRIP_CATCHUP_DIVISOR,
    minChars = DRIP_MIN_CHARS,
}) => {
    const state = { frame: 0, shown: 0, last: 0 };

    const stop = () => {
        if (state.frame) {
            cancel(state.frame);
            state.frame = 0;
        }
    };

    const tick = () => {
        state.frame = 0;
        const full = getFull();
        // The cursor can sit past the end when a new block shortened the buffer; `reset`
        // handles that case, and there is nothing to do here either way.
        if (state.shown >= full.length) return;
        const at = now();
        if (at - state.last < intervalMs) {
            state.frame = schedule(tick);
            return;
        }
        state.last = at;
        const step = Math.max(minChars, Math.ceil((full.length - state.shown) / catchupDivisor));
        state.shown = Math.min(full.length, state.shown + step);
        show(full.slice(0, state.shown));
        state.frame = schedule(tick);
    };

    return {
        /** Begin (or continue) revealing whatever `getFull` now holds. */
        start() {
            if (!state.frame) state.frame = schedule(tick);
        },
        /** Stop revealing and leave the cursor where it is. */
        stop,
        /** Send the cursor back to the start — the buffer was replaced, not appended to. */
        reset() {
            stop();
            state.shown = 0;
            state.last = 0;
        },
        /** Show `text` in full, immediately, and leave nothing pending. */
        flush(text) {
            stop();
            state.shown = text.length;
            show(text);
        },
        /** Characters currently on screen. Exposed for tests. */
        shown() {
            return state.shown;
        },
        /** Whether a frame is queued. Exposed for tests. */
        isRunning() {
            return Boolean(state.frame);
        },
    };
};
