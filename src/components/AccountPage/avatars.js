/**
 * The sixteen preset profile pictures.
 *
 * The backend stores only the index the user picked, 1..16 — the pictures
 * themselves are ours (see the avatar API contract). That makes this file the
 * mapping, and it is load-bearing: renumbering or reordering it silently
 * changes the picture of everyone who already chose one. Add to the end.
 *
 * PLACEHOLDER ARTWORK. The design shows one photographic avatar and the set of
 * sixteen was never handed over, so these are generated marks in the token
 * palette — enough to pick from and to prove the round trip, not the final art.
 * Replacing them means swapping the `render` of each entry; the ids must stay.
 */
import React from 'react';

/* Two token colours per preset: the disc and the mark on it. */
const PALETTE = [
    ['--color-node-gene-fill', '--color-node-gene-border'],
    ['--color-node-phenotype-fill', '--color-node-phenotype-border'],
    ['--color-node-chemical-fill', '--color-node-chemical-border'],
    ['--color-node-variant-fill', '--color-node-variant-border'],
    ['--color-node-go-biological-process-fill', '--color-node-go-biological-process-border'],
    ['--color-node-go-molecular-function-fill', '--color-node-go-molecular-function-border'],
    ['--color-node-go-cellular-component-fill', '--color-node-go-cellular-component-border'],
    ['--color-node-pathway-fill', '--color-node-pathway-border'],
    ['--color-node-anatomy-fill', '--color-node-anatomy-border'],
    ['--color-node-organism-fill', '--color-node-organism-border'],
    ['--color-node-mesh-term-fill', '--color-node-mesh-term-border'],
    ['--color-brand-muted', '--color-brand-primary'],
    ['--color-green-100', '--color-green-700'],
    ['--color-purple-100', '--color-purple-700'],
    ['--color-orange-100', '--color-orange-700'],
    ['--color-cyan-100', '--color-cyan-700'],
];

/* Four simple marks, cycled so neighbours in the grid differ. */
const MARKS = [
    <circle cx="24" cy="19" r="8" />,
    <rect x="15" y="11" width="18" height="18" rx="5" />,
    <path d="M24 9 L34 27 H14 Z" />,
    <path d="M24 9 a10 10 0 0 1 0 20 a10 10 0 0 1 0 -20 M24 13 a6 6 0 0 0 0 12 z" />,
];

export const AVATARS = PALETTE.map(([disc, mark], index) => ({
    id: index + 1,
    render: (props) => (
        <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
            <circle cx="24" cy="24" r="24" fill={`var(${disc})`} />
            <g fill={`var(${mark})`}>{MARKS[index % MARKS.length]}</g>
            <path
                d="M24 30c-7 0-12 4.2-12 9.4V48h24v-8.6C36 34.2 31 30 24 30Z"
                fill={`var(${mark})`}
                opacity="0.85"
            />
        </svg>
    ),
}));

/** The preset for a stored id, or null when the user has not chosen one. */
export const avatarById = (id) => AVATARS.find((avatar) => avatar.id === id) || null;

export default AVATARS;
