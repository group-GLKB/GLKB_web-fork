/**
 * The demo video, played on the page rather than on YouTube. Until the reader
 * presses play it is a poster and a button, so the page loads no player (and no
 * YouTube script) for readers who never watch.
 */
import React, { useEffect, useRef, useState } from 'react';

import { DEMO_VIDEO_ID } from '../SiteChrome';

export const DEMO_TITLE = 'GLKB demo video';
export const DEMO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&playsinline=1`;
const POSTER_URL = `https://i.ytimg.com/vi/${DEMO_VIDEO_ID}/maxresdefault.jpg`;

export const DemoPlayer = ({ autoplay = false }) => {
    const [playing, setPlaying] = useState(autoplay);
    return (
        <div className="about-demo-player">
            {playing ? (
                <iframe
                    src={DEMO_EMBED_URL}
                    title={DEMO_TITLE}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                />
            ) : (
                <button type="button" className="about-demo-poster" onClick={() => setPlaying(true)} aria-label="Play the GLKB demo video">
                    <img src={POSTER_URL} alt="" loading="lazy" />
                    <span className="about-demo-play" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                    </span>
                </button>
            )}
        </div>
    );
};

/** The same player over the page, for the View Demo buttons. */
export const DemoModal = ({ open, onClose }) => {
    const closeRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const opener = document.activeElement;
        closeRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
        };
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div
            className="about-demo-modal"
            role="dialog"
            aria-modal="true"
            aria-label={DEMO_TITLE}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="about-demo-modal-frame">
                <button ref={closeRef} type="button" className="about-demo-close" onClick={onClose} aria-label="Close video">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
                <DemoPlayer autoplay />
            </div>
        </div>
    );
};
