/**
 * The floating "Reply" button over a selection in an assistant answer (quoteReply.js says what
 * counts as one). Pressing it hands the selected text to `onReply`, which puts it on the
 * composer as a quote.
 *
 * The selection is read the way the Literature Review's toolbar reads it (ReviewDocument.jsx):
 * when the mouse is let go, after a keyboard selection, and — a finger's selection handles have
 * no mouse — once the selection has stopped changing for a moment, so the button does not chase
 * a selection that is still being dragged out on a touch screen.
 *
 * Rendered into <body>: it is `position: fixed`, and nothing in the chat page's layout may
 * become its containing block.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import ReplyIcon from '@mui/icons-material/Reply';

import { readAnswerSelection, replyButtonAt } from './quoteReply';

/** How long a touch selection has to hold still before the button shows. */
export const TOUCH_SETTLE_MS = 400;
const OWN_CLASS = 'chat-selection-reply';

const SelectionReply = ({ containerRef, onReply, touch = false }) => {
    const [tool, setTool] = useState(null);
    const mouseDownRef = useRef(false);
    const touchRef = useRef(false);

    useEffect(() => {
        let timer = null;
        const read = (delay = 0) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const found = readAnswerSelection(containerRef?.current || null);
                setTool(found
                    ? { text: found.text, range: found.range, ...replyButtonAt(found.range, touch || touchRef.current) }
                    : null);
            }, delay);
        };
        const ours = (event) => Boolean(event?.target?.closest?.(`.${OWN_CLASS}`));
        const onMouseDown = (event) => {
            if (ours(event)) return;
            mouseDownRef.current = true;
            touchRef.current = false;
        };
        const onMouseUp = (event) => {
            mouseDownRef.current = false;
            if (!ours(event)) read(0);
        };
        const onTouchStart = (event) => {
            if (ours(event)) return;
            touchRef.current = true;
        };
        const onTouchEnd = (event) => {
            if (!ours(event)) read(TOUCH_SETTLE_MS);
        };
        const onKeyUp = (event) => {
            if (event.key === 'Escape') {
                clearTimeout(timer);
                setTool(null);
                return;
            }
            if (event.shiftKey || String(event.key).startsWith('Arrow')
                || ((event.metaKey || event.ctrlKey) && event.key === 'a')) {
                read(0);
            }
        };
        // While a mouse drags a selection out it changes on every move; that one is read on
        // mouseup. Any other change — touch handles, a selection collapsing — once it settles.
        const onSelectionChange = () => {
            if (!mouseDownRef.current) read(TOUCH_SETTLE_MS);
        };
        const onMove = () => setTool((current) => (
            current ? { ...current, ...replyButtonAt(current.range, touch || touchRef.current) } : current
        ));
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('selectionchange', onSelectionChange);
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('resize', onMove);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('selectionchange', onSelectionChange);
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
        };
    }, [containerRef, touch]);

    if (!tool || typeof document === 'undefined') return null;

    const reply = () => {
        const { text } = tool;
        setTool(null);
        try {
            window.getSelection?.()?.removeAllRanges?.();
        } catch (error) {
            /* nothing selected any more is the goal either way */
        }
        onReply?.(text);
    };

    return createPortal(
        <div
            className={OWN_CLASS}
            role="toolbar"
            aria-label="Selection actions"
            style={{ top: tool.top, left: tool.left }}
            // Pressing the button must not take the selection away before it is read.
            onMouseDown={(event) => event.preventDefault()}
        >
            <button type="button" onClick={reply}>
                <ReplyIcon className="chat-selection-reply-icon" aria-hidden="true" />
                Reply
            </button>
        </div>,
        document.body,
    );
};

export default SelectionReply;
