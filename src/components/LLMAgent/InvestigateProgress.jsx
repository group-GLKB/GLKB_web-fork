/**
 * Investigate progress panel — the "thinking" surface shown while a Deep Research run streams.
 *
 * Layout follows the Figma `Inverstigate` frames; motion follows MOTION-SPEC.md, which was
 * measured frame-by-frame off the design recording. The two rules that matter most:
 *
 *  1. It must start moving the moment the user hits send and never stall. The agent's `percent`
 *     is a step function with minutes between steps, so it is treated as a *target* and the bar
 *     eases toward it, then creeps slowly toward (next phase floor − 1) so it is never static.
 *  2. Numbers count up on first appearance and are instant afterwards; an unknown value is an
 *     en dash, never a zero.
 *
 * Everything animated here is display-only. Under `prefers-reduced-motion: reduce` the count-up,
 * the paper cycling and the bar creep are all skipped and final values render immediately.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SearchOutlinedIcon from '@mui/icons-material/Search';
import SegmentOutlinedIcon from '@mui/icons-material/SegmentOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import {
    INVESTIGATE_PHASE_META,
    PHASE_PERCENT_FLOOR,
    phaseIndex,
    phasePercentCap,
} from '../../service/investigatePhases';

// ── tuning ──────────────────────────────────────────────────────────────────────────────────
const COUNT_UP_MS = 1100;        // measured: Retrieved 1.30s, Screened 1.87s, Extracted 0.77s, Cited 1.03s
const TITLE_FADE_MS = 250;       // measured: fade out to blank then in, 0.47–0.53s total
const PAPER_HOLD_MS = 1650;      // measured: 2.0s period = 1.65s hold + 0.35s crossfade
const PAPER_FADE_MS = 220;
const PAPERS_PER_PAGE = 2;
const CYCLE_PERIOD_MS = 900;    // one-line detail rotation: brisk enough to read as live
const BAR_EASE_TAU = 0.30;       // seconds — catching up to a newly arrived target
const BAR_CREEP_TAU = 55;        // seconds — the slow drift between targets, so the bar never sits still
const ELAPSED_TICK_MS = 500;     // twice a second, so the displayed second is never >0.5s stale

/**
 * While a counter's real value is still unknown, the design has it "ticking up (fake)" rather
 * than sitting on an en dash (content-mapping doc, T1–T6).
 *
 * The ramp climbs from 1 toward a per-run random ceiling, in random-sized steps at a random
 * cadence, so no two runs count identically. Step size is a fraction of what is left, which makes
 * it decelerate and settle rather than hit the ceiling and freeze.
 *
 * When the true number lands, `addsToReal` decides what happens to the ramp:
 *   false - it is discarded and the counter animates onto the real value alone;
 *   true  - the value the ramp reached is ADDED, so the counter settles on `real + ramp`.
 * Retrieved is the one column with `addsToReal`, by product decision. Note what that means: the
 * figure it ends on is NOT the number of records the run identified, it is that number plus a
 * random 2,500-3,000. Every other counter shows only measured values.
 * Set FAKE_TICK_ENABLED = false to leave unknown counters as an en dash instead.
 */
const FAKE_TICK_ENABLED = true;
const RAMP_MIN_INTERVAL_MS = 70;
const RAMP_MAX_INTERVAL_MS = 430;
const RAMP_MIN_CATCHUP = 0.25;          // per tick, how much of the gap to the curve to close
const RAMP_MAX_CATCHUP = 1.0;

/**
 * Per-counter ramp: a random ceiling and a random time constant.
 *
 * The pace is set by ELAPSED TIME, not by the distance left. An earlier version stepped by a
 * fraction of what remained, which converges geometrically: it covered most of the range in the
 * first half-minute and then crawled by ones for the rest of a multi-minute phase, which reads as
 * stuck. Now the counter follows `ceiling * (1 - e^(-t/tau))`, so `tauMs` is roughly how long it
 * takes to cover ~63% of the range and it is still visibly moving minutes in. Per-tick steps
 * close a random share of the gap to that curve, so the motion stays irregular.
 */
const RAMP_RANGE = {
    retrieved: { min: 2500, max: 3000, tauMin: 70000, tauMax: 110000, addsToReal: true },
    screened: { min: 12, max: 40, tauMin: 20000, tauMax: 35000, addsToReal: false },
    extracted: { min: 4, max: 16, tauMin: 15000, tauMax: 30000, addsToReal: false },
    cited: { min: 3, max: 12, tauMin: 20000, tauMax: 40000, addsToReal: false },
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

const prefersReducedMotion = () => {
    try {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
        return false;
    }
};

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ── elapsed clock ───────────────────────────────────────────────────────────────────────────
/**
 * `m:ss`, minutes uncapped (a 73-minute run reads `73:20`, not `13:20`).
 *
 * Also backs the "Investigated for m:ss" summary row that replaces this panel when the run
 * closes — one formatter, fed from the one `Date.now()` taken at submit, so the number the user
 * watched tick is exactly the number they are left with. Truncating (not rounding) is what makes
 * that hold: rounding the final duration would print 7:54 over a clock that last read 7:53.
 */
export const formatElapsed = (totalSeconds) => {
    const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Seconds since `startedAt`, ticking until `running` goes false.
 *
 * Recomputed from the absolute start on every tick rather than incremented, so a throttled
 * background tab or a slow frame cannot make the clock drift away from real elapsed time.
 * State holds whole seconds: a tick that lands inside the same second sets an identical number and
 * React bails out, so the twice-a-second interval costs at most one re-render per second.
 *
 * A missing `startedAt` falls back to mount time. That keeps the clock plausible instead of
 * printing the ~56 years that `Date.now() - 0` would give.
 */
const useElapsedSeconds = (startedAt, running) => {
    const mountedAt = useRef(Date.now());
    const origin = Number.isFinite(Number(startedAt)) && Number(startedAt) > 0
        ? Number(startedAt)
        : mountedAt.current;
    const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - origin) / 1000)));

    useEffect(() => {
        const read = () => setSeconds(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
        read();                                   // land on the right value before the first tick
        if (!running) return undefined;           // frozen at the final time once the run closes
        const id = setInterval(read, ELAPSED_TICK_MS);
        return () => clearInterval(id);
    }, [origin, running]);

    return seconds;
};

// ── the step rows ───────────────────────────────────────────────────────────────────────────
// Fixed rows in run order. `active`/`done` are the present/past tense forms; a row flips to past
// tense when a LATER phase has been seen (MOTION-SPEC §5 — the recording flips it early, which it
// flags as a prototype artefact).
const STEP_ROWS = [
    {
        key: 'planning',
        phases: ['planning'],
        icon: TuneOutlinedIcon,
        active: () => 'Planning the investigation',
        done: () => 'Planned the investigation',
    },
    {
        key: 'searching',
        phases: ['searching', 'screening'],
        icon: SearchOutlinedIcon,
        active: (f, phase) => (phase === 'screening'
            ? 'Narrowing down by relevance'
            : 'Searching for literature'),
        done: () => 'Searched the literature',
    },
    {
        key: 'reading',
        phases: ['reading'],
        icon: VisibilityOutlinedIcon,
        active: (f) => `Reading ${f.screened ?? ''} paper${f.screened === 1 ? '' : 's'}`.replace('  ', ' '),
        done: (f) => `Read ${f.screened ?? ''} paper${f.screened === 1 ? '' : 's'}`.replace('  ', ' '),
    },
    {
        key: 'analyzing',
        phases: ['analyzing'],
        icon: SegmentOutlinedIcon,
        active: (f, phase, d) => `Organizing the evidence into ${d.nClaims ?? '?'} claims across ${d.nFacets ?? '?'} topic facets`,
        done: (f, phase, d) => `Organized the evidence into ${d.nClaims ?? '?'} claims across ${d.nFacets ?? '?'} topic facets`,
    },
    {
        key: 'writing',
        phases: ['writing'],
        icon: EditOutlinedIcon,
        active: (f, phase, d) => `Writing the ${d.totalSections || 6}-section investigation report`,
        done: (f, phase, d) => `Wrote the ${d.totalSections || 6}-section investigation report`,
    },
    {
        key: 'verifying',
        phases: ['verifying'],
        icon: FactCheckOutlinedIcon,
        active: () => 'Verifying every conclusion against its cited evidence',
        done: () => 'Verified every conclusion against its cited evidence',
    },
    {
        key: 'polishing',
        phases: ['finalizing'],
        icon: AutoAwesomeOutlinedIcon,
        active: () => 'Polishing the report',
        done: () => 'Polished the report',
    },
];

const rowForPhase = (phase) => STEP_ROWS.find((r) => r.phases.includes(phase)) || null;

// `filledFrom` is the phase at which a counter starts moving, per the content-mapping doc:
// Retrieved from T1, Screened from T2, Extracted from T4 (the analyzing mark), Cited from T6.
// Starting a counter earlier than its phase would show motion for a number nothing is producing.
const FUNNEL_COLUMNS = [
    { key: 'retrieved', label: 'Retrieved', filledFrom: 'searching' },
    { key: 'screened', label: 'Screened', filledFrom: 'screening' },
    { key: 'extracted', label: 'Extracted', filledFrom: 'analyzing' },
    { key: 'cited', label: 'Cited', filledFrom: 'writing' },
];

// ── counter ─────────────────────────────────────────────────────────────────────────────────
/**
 * One funnel counter. Counts up from 0 on the FIRST real value (easeOutCubic), then applies
 * later changes instantly. While the value is unknown but its phase has started, it shows the
 * decelerating fake ramp described above.
 */
const FunnelCounter = ({ value, label, columnKey, ticking, reduced }) => {
    const [shown, setShown] = useState(null);
    const hasAnimatedRef = useRef(false);
    const rafRef = useRef(null);
    const rampRef = useRef(null);          // { ceiling, value, nextAt } — survives re-renders
    const config = RAMP_RANGE[columnKey] || RAMP_RANGE.cited;

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    // Real value: animate on first appearance, snap afterwards.
    useEffect(() => {
        if (value === null || value === undefined) return undefined;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        // Where the ramp got to before the truth arrived.
        const reached = rampRef.current ? rampRef.current.value : 0;
        const target = value + (config.addsToReal ? reached : 0);
        if (reduced || hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            setShown(target);
            return undefined;
        }
        hasAnimatedRef.current = true;
        // Animate from wherever the ramp left off — snapping back to 0 first would read as the
        // counter losing its place. Works in both directions: the ramp may have overshot the
        // truth (small pool) or fallen short of it (the usual case).
        const from = reached;
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / COUNT_UP_MS);
            setShown(Math.round(from + (target - from) * easeOutCubic(t)));
            if (t < 1) rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [value, reduced, config.addsToReal]);

    // Unknown value, phase in flight: the random ramp.
    useEffect(() => {
        const shouldRamp = FAKE_TICK_ENABLED && !reduced && ticking
            && (value === null || value === undefined);
        if (!shouldRamp) return undefined;

        if (!rampRef.current) {
            rampRef.current = {
                // one ceiling and one pace per run, so two runs never count the same way
                ceiling: Math.round(randomBetween(config.min, config.max)),
                tauMs: randomBetween(config.tauMin, config.tauMax),
                startedAt: null,
                value: 1,
                nextAt: 0,
            };
            setShown(1);
        }
        let alive = true;
        const step = (now) => {
            if (!alive) return;
            const r = rampRef.current;
            if (r.startedAt === null) r.startedAt = now;
            if (now >= r.nextAt) {
                // where the curve says we should be by now
                const ideal = r.ceiling * (1 - Math.exp(-(now - r.startedAt) / r.tauMs));
                const gap = ideal - r.value;
                if (gap > 0) {
                    const jump = Math.max(1, Math.round(
                        gap * randomBetween(RAMP_MIN_CATCHUP, RAMP_MAX_CATCHUP)));
                    r.value = Math.min(r.ceiling, r.value + jump);
                    setShown(r.value);
                }
                r.nextAt = now + randomBetween(RAMP_MIN_INTERVAL_MS, RAMP_MAX_INTERVAL_MS);
            }
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => {
            alive = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [ticking, value, reduced, config.min, config.max, config.tauMin, config.tauMax]);

    const text = (shown === null || shown === undefined) ? '–' : Number(shown).toLocaleString();
    return (
        <Box className="ip-counter">
            <span className="ip-counter-value">{text}</span>
            <span className="ip-counter-label">{label}</span>
        </Box>
    );
};

// ── detail blocks ───────────────────────────────────────────────────────────────────────────
/**
 * A detail list that CYCLES rather than sitting still.
 *
 * A phase can run for minutes between progress frames, so a detail block that only changes when a
 * frame arrives reads as frozen — the searching block in particular showed the same three lines
 * for the whole retrieval phase. Instead it shows a slice at a time and rotates, and a toggle
 * opens the full list for anyone who wants to read it all. Nothing is hidden; it is paced.
 */
const CyclingDetail = ({ items, perPage = 1, periodMs = CYCLE_PERIOD_MS, reduced, render, noun,
                        onExpandChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [page, setPage] = useState(0);
    const [visible, setVisible] = useState(true);
    const pages = Math.max(1, Math.ceil(items.length / perPage));

    // Back to the front whenever the list grows. Finished probes are prepended, so a new arrival
    // showing immediately is the point — it is the newest thing that happened.
    useEffect(() => { setPage(0); }, [items.length, perPage]);

    useEffect(() => {
        if (expanded || reduced || pages <= 1) return undefined;
        let cancelled = false;
        const hold = setTimeout(() => {
            if (cancelled) return;
            setVisible(false);
            setTimeout(() => {
                if (cancelled) return;
                setPage((p) => (p + 1) % pages);
                setVisible(true);
            }, PAPER_FADE_MS);
        }, periodMs);
        return () => { cancelled = true; clearTimeout(hold); };
    }, [page, pages, expanded, reduced, periodMs]);

    if (!items.length) return null;
    const slice = expanded ? items : items.slice(page * perPage, page * perPage + perPage);

    return (
        <>
            <div className={`ip-cycle${visible || expanded ? '' : ' hidden'}`}>
                {slice.map((item, i) => render(item, `${page}-${i}`))}
            </div>
            {items.length > perPage && (
                <button
                    type="button"
                    className="ip-cycle-toggle"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((v) => {
                            if (typeof onExpandChange === 'function') onExpandChange(!v);
                            return !v;
                        });
                    }}
                >
                    {expanded ? 'Show less' : `Show all ${items.length} ${noun}`}
                </button>
            )}
        </>
    );
};

const SearchingDetail = ({ label, topic, keywords, channels, reduced, onExpandChange }) => {
    // Topics and queries BOTH cycle, one at a time. Rendering the topic list as a joined
    // paragraph made it wrap past the height of the block, which pushed the rotating query and
    // the "show all" control out of sight — the feature was running, just underneath the fold.
    // Finished probes go FIRST: they are the newest information and the only thing that changes
    // during the long stretch between the plan landing and the pool being fused.
    const items = [
        ...(channels || []).map((c) => ({ kind: 'channel', text: c.name, hits: c.hits, ok: c.ok })),
        ...(topic || []).map((t) => ({ kind: 'topic', text: t })),
        ...(keywords || []).map((k) => ({ kind: 'query', text: k })),
    ];
    return (
        <>
            {label ? <p className="ip-detail-para">{label}</p> : null}
            <CyclingDetail
                items={items}
                perPage={1}
                periodMs={CYCLE_PERIOD_MS}
                reduced={reduced}
                noun="topics & searches"
                onExpandChange={onExpandChange}
                render={(item, key) => (
                    <p className="ip-detail-bullet" key={key}>
                        {item.kind === 'channel' && (
                            <span className={`ip-channel${item.ok ? '' : ' failed'}`}>
                                {item.ok ? '✓' : '✕'} {item.text}
                                {item.ok ? <span className="ip-channel-hits"> — {item.hits} hits</span> : ' — unavailable'}
                            </span>
                        )}
                        {item.kind === 'topic' && <>Topic: {item.text}</>}
                        {item.kind === 'query' && <span className="ip-chip">{item.text}</span>}
                    </p>
                )}
            />
        </>
    );
};

/** Papers, two at a time, cycling through the whole set (MOTION-SPEC §6). */
const ReadingDetail = ({ papers, reduced, onExpandChange }) => (
    <CyclingDetail
        items={papers}
        perPage={PAPERS_PER_PAGE}
        periodMs={PAPER_HOLD_MS}
        reduced={reduced}
        noun="papers"
        onExpandChange={onExpandChange}
        render={(p, key) => (
            <p className="ip-detail-para" key={p.pmid || p.id || key}>
                {p.pmid ? (
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`} target="_blank" rel="noreferrer">
                        [{p.pmid}]
                    </a>
                ) : null}{' '}
                {p.title}
                {(p.journal || p.year) ? ` — ${[p.journal, p.year].filter(Boolean).join(' (')}${p.year ? ')' : ''}` : ''}
            </p>
        )}
    />
);

const AnalyzingDetail = ({ facets, nClaims, nConflicted }) => (
    <>
        {facets && facets.length ? <p className="ip-detail-bullet">Facets: {facets.join(', ')}</p> : null}
        {nClaims !== null && nClaims !== undefined
            ? <p className="ip-detail-bullet">Number of claims: {nClaims}</p> : null}
        {nConflicted !== null && nConflicted !== undefined
            ? <p className="ip-detail-bullet">Conflicted claims: {nConflicted}</p> : null}
    </>
);

const REPORT_SECTIONS = 'Direct answer, Investigation findings, Evidence analysis, '
    + 'Conflict analysis, Evidence-based judgment, Remaining uncertainties';

const WritingDetail = ({ section, step, total }) => (
    <>
        <p className="ip-detail-para">Sections: {REPORT_SECTIONS}</p>
        {section ? (
            <p className="ip-detail-bullet">
                Drafting {section}{step && total ? ` (${step}/${total})` : ''}
            </p>
        ) : null}
    </>
);

// ── panel ───────────────────────────────────────────────────────────────────────────────────
const InvestigateProgress = ({
    phase = 'planning',
    funnel,
    percent,
    keywords = [],
    papers = [],
    detail = {},
    label = '',
    startedAt = null,
    done = false,
    expanded = true,
    onToggleExpanded,
    notifyEmailEnabled = false,
    onToggleNotifyEmail,
}) => {
    const reduced = useMemo(prefersReducedMotion, []);
    const safeFunnel = funnel || {};
    const meta = INVESTIGATE_PHASE_META[phase] || INVESTIGATE_PHASE_META.planning;
    const idx = phaseIndex(phase);
    const elapsedSeconds = useElapsedSeconds(startedAt, !done);

    // ── header title: fade to blank, swap, fade back in (not a crossfade) ──
    const [shownTitle, setShownTitle] = useState(meta.title);
    const [titleVisible, setTitleVisible] = useState(true);
    const titleRef = useRef(meta.title);
    useEffect(() => {
        const next = done ? INVESTIGATE_PHASE_META.summary.title : meta.title;
        if (next === titleRef.current) return undefined;
        if (reduced) {
            titleRef.current = next;
            setShownTitle(next);
            return undefined;
        }
        setTitleVisible(false);
        const t = setTimeout(() => {
            titleRef.current = next;
            setShownTitle(next);
            setTitleVisible(true);
        }, TITLE_FADE_MS);
        return () => clearTimeout(t);
    }, [meta.title, done, reduced]);

    // ── progress bar: ease to the target, then creep, never decrease ──
    // A cycling detail list can be opened in full; the clipped container has to open with it.
    const [detailExpanded, setDetailExpanded] = useState(false);
    const [barPct, setBarPct] = useState(PHASE_PERCENT_FLOOR.planning);
    const targetRef = useRef(PHASE_PERCENT_FLOOR.planning);
    const capRef = useRef(phasePercentCap('planning'));
    const barRef = useRef(PHASE_PERCENT_FLOOR.planning);

    useEffect(() => {
        const floor = PHASE_PERCENT_FLOOR[phase] ?? 0;
        const fromAgent = Number.isFinite(Number(percent)) ? Number(percent) : null;
        targetRef.current = Math.max(targetRef.current, floor, fromAgent ?? 0);
        capRef.current = done ? 100 : Math.max(targetRef.current, phasePercentCap(phase));
    }, [phase, percent, done]);

    useEffect(() => {
        if (done) {
            barRef.current = 100;
            setBarPct(100);
            return undefined;
        }
        if (reduced) {
            barRef.current = Math.max(barRef.current, targetRef.current);
            setBarPct(barRef.current);
            return undefined;
        }
        let raf = null;
        let last = performance.now();
        const tick = (now) => {
            const dt = Math.min(0.25, (now - last) / 1000);
            last = now;
            const cur = barRef.current;
            const target = targetRef.current;
            const cap = Math.min(99.4, capRef.current);
            const next = cur < target
                ? cur + (target - cur) * Math.min(1, dt / BAR_EASE_TAU)   // catch up to a new target
                : cur + (Math.max(cur, cap) - cur) * (dt / BAR_CREEP_TAU); // otherwise drift, never stall
            barRef.current = Math.max(cur, Math.min(99.4, next));
            setBarPct(barRef.current);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { if (raf) cancelAnimationFrame(raf); };
    }, [done, reduced]);

    useEffect(() => { setDetailExpanded(false); }, [phase]);

    const toggle = useCallback(() => {
        if (typeof onToggleExpanded === 'function') onToggleExpanded();
    }, [onToggleExpanded]);

    // Rows for phases that have started. The active row is the current phase's; everything
    // before it is done. On completion every row is done and no detail block is left open.
    const rows = useMemo(() => {
        const activeRow = rowForPhase(phase);
        const out = [];
        STEP_ROWS.forEach((row) => {
            const rowIdx = Math.min(...row.phases.map(phaseIndex));
            if (rowIdx > idx) return;
            const isActive = !done && activeRow && row.key === activeRow.key;
            out.push({ row, isActive });
        });
        return out;
    }, [phase, idx, done]);

    const detailFor = (rowKey) => {
        if (rowKey === 'searching') {
            return (
                <SearchingDetail
                    label={label}
                    topic={detail.topic}
                    keywords={keywords}
                    channels={detail.channels}
                    reduced={reduced}
                    onExpandChange={setDetailExpanded}
                />
            );
        }
        if (rowKey === 'reading') {
            return papers.length
                ? <ReadingDetail papers={papers} reduced={reduced} onExpandChange={setDetailExpanded} />
                : null;
        }
        if (rowKey === 'analyzing') {
            return (
                <AnalyzingDetail
                    facets={detail.facets}
                    nClaims={detail.nClaims}
                    nConflicted={detail.nConflicted}
                />
            );
        }
        if (rowKey === 'writing') {
            return <WritingDetail section={detail.section} step={detail.step} total={detail.totalSections} />;
        }
        return null;                     // planning / verifying / polishing have no detail block
    };

    const rowMeta = {
        nClaims: detail.nClaims,
        // prefer the agent's true count; the `facets` list is capped for display
        nFacets: detail.nFacets ?? (Array.isArray(detail.facets) ? detail.facets.length : undefined),
        totalSections: detail.totalSections,
    };

    return (
        <Box className="ip-shell">
            {/* The toggle is a real <button>, not a role="button" wrapper around the whole row —
                the notify control lives in this row too, and nesting one button inside another is
                invalid and makes both ambiguous to assistive tech. */}
            <Box className="ip-head">
                <button
                    type="button"
                    className="ip-head-left"
                    onClick={toggle}
                    aria-expanded={expanded}
                >
                    <ScienceOutlinedIcon className="ip-head-icon" />
                    <span className={`ip-head-title${titleVisible ? '' : ' fading'}`}>{shownTitle}</span>
                    <ExpandMoreIcon className={`ip-head-caret${expanded ? ' expanded' : ''}`} />
                </button>
                <Box className="ip-head-right">
                    {/* Elapsed, not an estimate. This was a hardcoded per-phase "~6 min" that
                        stepped only when the phase changed, so it sat unchanged for minutes next
                        to a moving bar — and its ladder never matched a measured run. Time spent
                        is a fact we have, and it keeps showing once `done` so the final figure
                        matches the "Investigated for m:ss" row that succeeds this panel. */}
                    <span className="ip-elapsed" title="Time spent investigating">
                        <AccessTimeOutlinedIcon fontSize="inherit" />{formatElapsed(elapsedSeconds)}
                    </span>
                    <button
                        type="button"
                        className={`ip-notify${notifyEmailEnabled ? ' active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onToggleNotifyEmail === 'function') onToggleNotifyEmail(!notifyEmailEnabled);
                        }}
                        title={notifyEmailEnabled
                            ? 'Email notification on — click to turn off'
                            : 'Email me when research completes'}
                    >
                        <NotificationsNoneOutlinedIcon fontSize="inherit" />
                        {notifyEmailEnabled ? 'Notify on' : 'Notify me'}
                    </button>
                </Box>
            </Box>

            {expanded && (
                <Box className="ip-body">
                    <Box className="ip-counters">
                        {FUNNEL_COLUMNS.map((col) => (
                            <FunnelCounter
                                key={col.key}
                                columnKey={col.key}
                                label={col.label}
                                value={safeFunnel[col.key] ?? null}
                                ticking={!done && idx >= phaseIndex(col.filledFrom)}
                                reduced={reduced}
                            />
                        ))}
                    </Box>

                    <Box className="ip-bar" role="progressbar" aria-valuenow={Math.round(barPct)}
                         aria-valuemin={0} aria-valuemax={100}>
                        <Box className="ip-bar-fill" style={{ width: `${barPct}%` }} />
                    </Box>

                    <Box className="ip-steps">
                        {rows.map(({ row, isActive }) => {
                            const Icon = row.icon;
                            const text = isActive
                                ? row.active(safeFunnel, phase, rowMeta)
                                : row.done(safeFunnel, phase, rowMeta);
                            const body = isActive ? detailFor(row.key) : null;
                            return (
                                <Box className={`ip-step${isActive ? ' active' : ' done'}`} key={row.key}>
                                    <Box className="ip-step-head">
                                        <Icon className="ip-step-icon" />
                                        <span className="ip-step-label">{text}</span>
                                    </Box>
                                    {body ? (
                                        <Box className={`ip-step-detail${detailExpanded ? ' expanded' : ''}`}>
                                            {body}
                                        </Box>
                                    ) : null}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default InvestigateProgress;
