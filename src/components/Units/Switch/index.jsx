/**
 * The toggle, from Figma 244:5052 (off) and 244:5056 (on).
 *
 * MUI's Switch is built around a 34x20 track with a shadowed 20px thumb and a ripple that
 * overflows both; the design's is a flat 28x16 track with a 12px thumb and no ripple at all.
 * Reshaping MUI's by hand at each call site is how the two in Settings ended up as the default
 * `size="small"`, which is a different shape again — so the reshaping lives here once.
 *
 *   track   28x16, radius/2, 2px of padding, background/normal off and brand/primary on
 *   thumb   12x12, radius/2, background/surface, travelling the 12px between those paddings
 *
 * The switch is the control, so it takes the label by aria-label rather than rendering one:
 * both places that use it draw their own, and the design gives it no label of its own.
 */
import React from 'react';
import { Switch as MuiSwitch } from '@mui/material';

const TRACK_W = 28;
const TRACK_H = 16;
const THUMB = 12;
const PAD = 2;
/** What is left of the track once the thumb and both paddings are taken out of it. */
const TRAVEL = TRACK_W - THUMB - PAD * 2;

const SX = {
    width: TRACK_W,
    height: TRACK_H,
    padding: 0,
    display: 'flex',
    '& .MuiSwitch-switchBase': {
        padding: `${PAD}px`,
        color: 'var(--color-background-surface)',
        '&.Mui-checked': {
            transform: `translateX(${TRAVEL}px)`,
            color: 'var(--color-background-surface)',
            '& + .MuiSwitch-track': {
                backgroundColor: 'var(--color-brand-primary)',
                opacity: 1,
            },
        },
        // No ripple: it is larger than the whole control.
        '&:hover, &.Mui-checked:hover': { backgroundColor: 'transparent' },
    },
    '& .MuiSwitch-thumb': {
        width: THUMB,
        height: THUMB,
        borderRadius: 'var(--radius-2, 8px)',
        backgroundColor: 'var(--color-background-surface)',
        // The design's thumb is flat.
        boxShadow: 'none',
    },
    '& .MuiSwitch-track': {
        borderRadius: 'var(--radius-2, 8px)',
        backgroundColor: 'var(--color-background-normal)',
        opacity: 1,
    },
    '& .Mui-disabled + .MuiSwitch-track': { opacity: 0.5 },
};

export const Switch = ({ sx, ...rest }) => (
    <MuiSwitch
        disableRipple
        focusVisibleClassName="Mui-focusVisible"
        {...rest}
        sx={{ ...SX, ...(sx || {}) }}
    />
);

export default Switch;
