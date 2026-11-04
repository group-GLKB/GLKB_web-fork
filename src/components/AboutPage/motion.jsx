/**
 * Scroll-linked motion for the About page.
 *
 * Every scene reads one number, its progress through the viewport, which a
 * rAF-throttled listener writes to a CSS custom property on the scene's own
 * element. Most of the motion is then plain CSS reading var(--p); a callback
 * covers what CSS cannot do (the canvas, the counters, which step is showing).
 *
 * Nothing here touches `window` during render, so the prerender
 * (scripts/prerender.cjs, renderToString) sees the static page.
 */
import React, { useEffect, useRef, useState } from 'react';

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Maps `value` within [start, end] onto 0..1. */
export const segment = (value, start, end) => clamp01((value - start) / (end - start));

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
export const easeOut = (t) => 1 - ((1 - t) ** 3);

/**
 * 'pin'  — a tall section around a sticky stage: 0 when the section's top
 *          reaches the top of the viewport, 1 when its bottom reaches the bottom.
 * 'pass' — an element crossing the viewport: 0 as its top enters at the bottom,
 *          1 as its bottom leaves at the top.
 */
export const measureProgress = (rect, viewportHeight, mode) => {
    if (mode === 'pin') {
        const span = rect.height - viewportHeight;
        if (span <= 0) return rect.top <= 0 ? 1 : 0;
        return clamp01(-rect.top / span);
    }
    return clamp01((viewportHeight - rect.top) / (viewportHeight + rect.height));
};

/**
 * Writes the element's progress to `property` on every scroll frame, and hands
 * it, the element's rect and the viewport height to `onProgress`.
 */
export const useScrollProgress = (ref, { mode = 'pass', property = '--p', onProgress } = {}) => {
    const callbackRef = useRef(onProgress);
    callbackRef.current = onProgress;

    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;
        let frame = 0;
        let last = null;
        const update = () => {
            frame = 0;
            const rect = element.getBoundingClientRect();
            const viewport = window.innerHeight || 1;
            const progress = measureProgress(rect, viewport, mode);
            // Off screen nothing changes; on screen a scene may still be arriving
            // (its pin progress still 0) and need the callback.
            const onScreen = rect.bottom > 0 && rect.top < viewport;
            if (last !== null && progress === last && !onScreen) return;
            last = progress;
            element.style.setProperty(property, progress.toFixed(4));
            callbackRef.current?.(progress, rect, viewport);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        // Capture, so the page still moves if it ends up inside a scrolling container.
        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule, { capture: true });
            window.removeEventListener('resize', schedule);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [ref, mode, property]);
};

/** True unless the reader asked for reduced motion. False during the prerender. */
export const useMotionAllowed = () => {
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') {
            setAllowed(true);
            return undefined;
        }
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setAllowed(!query.matches);
        sync();
        query.addEventListener?.('change', sync);
        return () => query.removeEventListener?.('change', sync);
    }, []);
    return allowed;
};

/**
 * Adds `is-in` to every `[data-reveal]` under `rootRef` the first time it
 * scrolls into view. The hidden starting state lives in CSS under
 * `.about-page--motion`, so the prerendered page and a reduced-motion reader
 * see everything at once.
 */
export const useReveal = (rootRef, enabled) => {
    useEffect(() => {
        const root = rootRef.current;
        if (!root || !enabled) return undefined;
        const targets = root.querySelectorAll('[data-reveal]');
        if (typeof window.IntersectionObserver !== 'function') {
            targets.forEach((target) => target.classList.add('is-in'));
            return undefined;
        }
        const observer = new window.IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
        targets.forEach((target) => observer.observe(target));
        return () => observer.disconnect();
    }, [rootRef, enabled]);
};

/** A wrapper whose `--v` follows it across the viewport, for parallax and scale. */
export const Track = ({ as: Tag = 'div', className, children, ...rest }) => {
    const ref = useRef(null);
    useScrollProgress(ref, { mode: 'pass', property: '--v' });
    return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
};

const NUMBER = /^([^\d]*)([\d.,]+)(.*)$/;

/**
 * Counts up to `value` (e.g. "41.2M+", "+24.8%", "~30 min") the first time it
 * is seen. Renders the final figure on the server and without motion.
 */
export const CountUp = ({ value, className, motion, duration = 1600 }) => {
    const ref = useRef(null);
    useEffect(() => {
        const element = ref.current;
        const match = NUMBER.exec(value);
        if (!element || !motion || !match || typeof window.IntersectionObserver !== 'function') return undefined;
        const [, prefix, digits, suffix] = match;
        const target = Number(digits.replace(/,/g, ''));
        const decimals = (digits.split('.')[1] || '').length;
        const grouped = digits.includes(',');
        const format = (n) => {
            const fixed = n.toFixed(decimals);
            return grouped ? Number(fixed).toLocaleString('en-US', { minimumFractionDigits: decimals }) : fixed;
        };
        element.textContent = `${prefix}${format(0)}${suffix}`;
        let frame = 0;
        const observer = new window.IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            const start = performance.now();
            const tick = (now) => {
                const t = easeOut(clamp01((now - start) / duration));
                element.textContent = `${prefix}${format(target * t)}${suffix}`;
                if (t < 1) frame = window.requestAnimationFrame(tick);
            };
            frame = window.requestAnimationFrame(tick);
        }, { threshold: 0.6 });
        observer.observe(element);
        return () => {
            observer.disconnect();
            if (frame) window.cancelAnimationFrame(frame);
            element.textContent = value;
        };
    }, [value, motion, duration]);
    return <span ref={ref} className={className}>{value}</span>;
};
