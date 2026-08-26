/**
 * The sixteen preset profile pictures, from Figma 589:7071 ("Profile Pictures").
 *
 * Each is a glyph on a tile filled with one of the --color-node-* families, so
 * the set is the same palette the knowledge graph uses.
 *
 * The backend stores only the index, 1..16, and the frame names its tiles
 * profile-1 .. profile-16 — this order is theirs. It is load-bearing:
 * renumbering silently changes the picture of everyone who already chose.
 * Add to the end.
 */
import React from 'react';

import glyph1 from '../../img/avatars/profile-1.svg';
import glyph2 from '../../img/avatars/profile-2.svg';
import glyph3 from '../../img/avatars/profile-3.svg';
import glyph4 from '../../img/avatars/profile-4.svg';
import glyph5 from '../../img/avatars/profile-5.svg';
import glyph6 from '../../img/avatars/profile-6.svg';
import glyph7 from '../../img/avatars/profile-7.svg';
import glyph8 from '../../img/avatars/profile-8.svg';
import glyph9 from '../../img/avatars/profile-9.svg';
import glyph10 from '../../img/avatars/profile-10.svg';
import glyph11 from '../../img/avatars/profile-11.svg';
import glyph12 from '../../img/avatars/profile-12.svg';
import glyph13 from '../../img/avatars/profile-13.svg';
import glyph14 from '../../img/avatars/profile-14.svg';
import glyph15 from '../../img/avatars/profile-15.svg';
import glyph16 from '../../img/avatars/profile-16.svg';

const PRESETS = [
    { id: 1, glyph: glyph1, fill: 'var(--color-node-gene-fill)' },
    { id: 2, glyph: glyph2, fill: 'var(--color-node-go-cellular-component-fill)' },
    { id: 3, glyph: glyph3, fill: 'var(--color-node-organism-fill)' },
    { id: 4, glyph: glyph4, fill: 'var(--color-node-chemical-fill)' },
    { id: 5, glyph: glyph5, fill: 'var(--color-node-go-biological-process-fill)' },
    { id: 6, glyph: glyph6, fill: 'var(--color-node-variant-fill)' },
    { id: 7, glyph: glyph7, fill: 'var(--color-node-gene-fill)' },
    { id: 8, glyph: glyph8, fill: 'var(--color-node-mesh-term-fill)' },
    { id: 9, glyph: glyph9, fill: 'var(--color-node-go-molecular-function-fill)' },
    { id: 10, glyph: glyph10, fill: 'var(--color-node-anatomy-fill)' },
    { id: 11, glyph: glyph11, fill: 'var(--color-node-phenotype-fill)' },
    { id: 12, glyph: glyph12, fill: 'var(--color-node-pathway-fill)' },
    { id: 13, glyph: glyph13, fill: 'var(--color-node-gene-fill)' },
    { id: 14, glyph: glyph14, fill: 'var(--color-node-go-cellular-component-fill)' },
    { id: 15, glyph: glyph15, fill: 'var(--color-node-organism-fill)' },
    { id: 16, glyph: glyph16, fill: 'var(--color-node-chemical-fill)' },
];

export const AVATARS = PRESETS.map(({ id, glyph, fill }) => ({
    id,
    fill,
    glyph,
    render: ({ className } = {}) => (
        <span className={className} style={{ backgroundColor: fill }}>
            <img src={glyph} alt="" />
        </span>
    ),
}));

/** The preset for a stored id, or null when the user has not chosen one. */
export const avatarById = (id) => AVATARS.find((avatar) => avatar.id === id) || null;

export default AVATARS;
