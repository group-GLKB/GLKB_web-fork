/**
 * nodeStyle.js holds literal colours because cytoscape and the pill helpers
 * parse the strings themselves and var() means nothing to them. That copy is
 * only safe while it matches the token file, so this checks it does.
 */
import fs from 'fs';
import path from 'path';

import { NODE_STYLES } from './nodeStyle';

const FAMILIES = {
    Gene: 'gene',
    DiseaseOrPhenotypicFeature: 'phenotype',
    ChemicalEntity: 'chemical',
    SequenceVariant: 'variant',
    MeshTerm: 'mesh-term',
    BiologicalProcessOrActivity: 'go-biological-process',
    MolecularFunction: 'go-molecular-function',
    CellularComponent: 'go-cellular-component',
    Pathway: 'pathway',
    AnatomicalEntity: 'anatomy',
    Organism: 'organism',
    Article: 'literature-content',
};

const tokens = () => {
    const css = fs.readFileSync(
        path.join(__dirname, '..', '..', 'styles', 'tokens.css'),
        'utf8',
    );
    const declared = {};
    css.replace(/^\s*(--[\w-]+):\s*([^;]+);/gm, (_, name, value) => {
        declared[name] = value.trim();
        return '';
    });
    const resolve = (value, depth = 0) => {
        const alias = /^var\((--[\w-]+)\)$/.exec(value);
        return alias && depth < 10 ? resolve(declared[alias[1]], depth + 1) : value;
    };
    return (name) => resolve(declared[name]);
};

describe('node entity colours', () => {
    const token = tokens();

    it('every label maps to a family the token file defines', () => {
        expect(Object.keys(NODE_STYLES).sort()).toEqual(Object.keys(FAMILIES).sort());
    });

    Object.entries(FAMILIES).forEach(([label, family]) => {
        it(`${label} matches --color-node-${family}-*`, () => {
            ['fill', 'border', 'text', 'ring'].forEach((slot) => {
                expect(NODE_STYLES[label][slot].toLowerCase())
                    .toBe(token(`--color-node-${family}-${slot}`).toLowerCase());
            });
        });
    });

    it('the ring is its border at 0.3 alpha, as the tokens describe', () => {
        Object.values(NODE_STYLES).forEach(({ border, ring }) => {
            expect(ring.toLowerCase()).toBe(`${border.toLowerCase()}4d`);
        });
    });
});
