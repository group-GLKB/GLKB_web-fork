/**
 * The page's own navigation. It slides in once the site nav has scrolled away,
 * links to each part of the story, marks the part being read, and shows how far
 * down the page the reader is. On narrow windows the links fold into a contents
 * menu under the current part's name. Over the dark knowledge-base scene it
 * turns dark with it.
 */
import React, { useEffect, useRef, useState } from 'react';

import { LITERATURE_REVIEW_ENABLED } from '../../config/features';
import siteMark from '../../img/GLKB_logo_icon.png';
import siteWordmark from '../../img/navbar/logo.png';

/* In page order: a part is "current" from when its top passes 40% down the window. */
export const PAGE_SECTIONS = [
    ['top', 'Overview'],
    ['knowledge-base', 'Knowledge Base'],
    ['how-it-works', 'How It Works'],
    ['demo', 'Demo'],
    ...(LITERATURE_REVIEW_ENABLED ? [['literature-review', 'Literature Review']] : []),
    ['from-the-lab', 'Blog'],
    ['why', 'Why GLKB'],
    ['use-cases', 'Use Cases'],
    ['faq', 'FAQ'],
];

/* The page scrolls inside the app layout's container, not the window. */
const scrollerOf = (element) => {
    let node = element?.parentElement;
    while (node && node !== document.body) {
        const { overflowY } = window.getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') return node;
        node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
};

const Chevron = () => (
    <svg className="about-localnav-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
);

const LocalNav = ({ motion, onTry }) => {
    const navRef = useRef(null);
    const progressRef = useRef(null);
    const [shown, setShown] = useState(false);
    const [active, setActive] = useState(PAGE_SECTIONS[0][0]);
    const [dark, setDark] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return undefined;
        const scroller = scrollerOf(nav);
        let frame = 0;
        const update = () => {
            frame = 0;
            const viewport = window.innerHeight || 1;
            const range = scroller.scrollHeight - scroller.clientHeight;
            if (progressRef.current) {
                progressRef.current.style.transform = `scaleX(${range > 0 ? Math.min(1, scroller.scrollTop / range).toFixed(4) : 0})`;
            }
            const siteNav = nav.previousElementSibling;
            setShown(siteNav ? siteNav.getBoundingClientRect().bottom <= 0 : scroller.scrollTop > 80);
            let current = PAGE_SECTIONS[0][0];
            PAGE_SECTIONS.forEach(([id]) => {
                const section = document.getElementById(id);
                if (section && section.getBoundingClientRect().top <= viewport * 0.4) current = id;
            });
            setActive(current);
            const scene = document.getElementById('knowledge-base');
            if (scene) {
                const rect = scene.getBoundingClientRect();
                const tone = parseFloat(scene.style.getPropertyValue('--tone')) || 0;
                setDark(rect.top <= 1 && rect.bottom > 60 && tone > 0.5);
            }
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule, { capture: true });
            window.removeEventListener('resize', schedule);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    // The contents menu closes on Escape, on a tap outside it, and when the bar hides.
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        const onPointerDown = (event) => {
            if (!navRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [open]);

    useEffect(() => {
        if (!shown) setOpen(false);
    }, [shown]);

    const go = (event, id) => {
        event.preventDefault();
        setOpen(false);
        const behavior = motion ? 'smooth' : 'auto';
        if (id === 'top') {
            scrollerOf(navRef.current).scrollTo({ top: 0, behavior });
        } else {
            document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
        }
        // Keep the address shareable without a router navigation (which would re-scroll).
        window.history.replaceState(window.history.state, '', `#${id}`);
    };

    const activeLabel = (PAGE_SECTIONS.find(([id]) => id === active) || PAGE_SECTIONS[0])[1];
    const className = ['about-localnav', shown && 'is-shown', dark && 'is-dark', open && 'is-open'].filter(Boolean).join(' ');

    return (
        <nav ref={navRef} className={className} aria-label="On this page">
            <div className="about-localnav-bar">
                {/* The site's own mark and wordmark, as in the site nav, not the name set in type. */}
                <a className="about-localnav-brand" href="#top" onClick={(event) => go(event, 'top')} aria-label="GLKB, back to the top">
                    <img className="about-localnav-mark" src={siteMark} alt="" />
                    <img className="about-localnav-wordmark" src={siteWordmark} alt="" />
                </a>
                <ol className="about-localnav-links">
                    {PAGE_SECTIONS.map(([id, label]) => (
                        <li key={id}>
                            <a
                                href={`#${id}`}
                                className={id === active ? 'is-active' : undefined}
                                aria-current={id === active ? 'true' : undefined}
                                onClick={(event) => go(event, id)}
                            >
                                {label}
                            </a>
                        </li>
                    ))}
                </ol>
                <button
                    type="button"
                    className="about-localnav-toggle"
                    aria-expanded={open}
                    aria-controls="about-localnav-menu"
                    onClick={() => setOpen((value) => !value)}
                >
                    <span className="about-localnav-toggle-hint">Contents</span>
                    <span className="about-localnav-toggle-label">{activeLabel}</span>
                    <Chevron />
                </button>
                <button type="button" className="about-localnav-cta" onClick={onTry}>Try GLKB</button>
                <span className="about-localnav-progress" aria-hidden="true"><i ref={progressRef} /></span>
            </div>
            <ol id="about-localnav-menu" className="about-localnav-menu" hidden={!open}>
                {PAGE_SECTIONS.map(([id, label], index) => (
                    <li key={id}>
                        <a
                            href={`#${id}`}
                            className={id === active ? 'is-active' : undefined}
                            aria-current={id === active ? 'true' : undefined}
                            onClick={(event) => go(event, id)}
                        >
                            <span className="about-localnav-menu-index">{String(index + 1).padStart(2, '0')}</span>
                            {label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default LocalNav;
