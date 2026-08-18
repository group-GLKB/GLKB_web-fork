/**
 * Entity colours, from the design's --color-node-* tokens.
 *
 * Cytoscape and the pill helpers parse these strings themselves, so they have
 * to be literal values rather than var() references. nodeStyle.test.js asserts
 * every one still matches tokens.css, which is what keeps the copy honest.
 *
 * `ring` is the border colour at 0.3 alpha, as the token file describes it.
 */
export const NODE_STYLES = {
    Gene: { fill: '#DDE8FA', border: '#4A80D4', text: '#0F2E70', ring: '#4A80D44D' },
    DiseaseOrPhenotypicFeature: { fill: '#FEEED8', border: '#E8A44A', text: '#7A4010', ring: '#E8A44A4D' },
    ChemicalEntity: { fill: '#D4F5EC', border: '#3DBFA0', text: '#0A5040', ring: '#3DBFA04D' },
    SequenceVariant: { fill: '#F2E8F8', border: '#C090D0', text: '#5A1E6A', ring: '#C090D04D' },
    MeshTerm: { fill: '#EFEDE7', border: '#A89880', text: '#4A3D2C', ring: '#A898804D' },
    BiologicalProcessOrActivity: { fill: '#E2F1DC', border: '#72B860', text: '#2A5A19', ring: '#72B8604D' },
    MolecularFunction: { fill: '#F8EEC0', border: '#C89400', text: '#4A3001', ring: '#C894004D' },
    CellularComponent: { fill: '#DAF4F8', border: '#40B8CC', text: '#094A58', ring: '#40B8CC4D' },
    Pathway: { fill: '#FAE4F0', border: '#C83880', text: '#6A0840', ring: '#C838804D' },
    AnatomicalEntity: { fill: '#E8ECF2', border: '#6890D0', text: '#1E3A5A', ring: '#6890D04D' },
    Organism: { fill: '#F5E7E0', border: '#C86030', text: '#5A2810', ring: '#C860304D' },
    Article: { fill: '#FFFFFF', border: '#7A8FA8', text: '#3A4A58', ring: '#7A8FA84D' },
};

/** Anything unrecognised is drawn as literature. */
export const nodeStyle = (label) => NODE_STYLES[label] || NODE_STYLES.Article;

export default nodeStyle;
