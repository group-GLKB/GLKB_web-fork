/**
 * The picture in the scale scene: a sheet of papers gathers into terms, the
 * terms link into a graph, and the graph turns. It stands in for an image
 * sequence: every frame is a pure function of scroll progress (plus a slow
 * idle drift when motion is allowed), so scrolling back plays it in reverse.
 */
import { clamp01, easeInOut, easeOut, segment } from './motion';

/* The entity types, in the knowledge graph's own node colours (styles/tokens.css). */
export const FIELD_TYPES = [
    { key: 'gene', label: 'Genes', color: [74, 128, 212] },
    { key: 'disease', label: 'Diseases', color: [232, 164, 74] },
    { key: 'chemical', label: 'Chemicals', color: [61, 191, 160] },
    { key: 'variant', label: 'Variants', color: [192, 144, 208] },
    { key: 'pathway', label: 'Pathways', color: [200, 56, 128] },
];

/* A few nodes carry names, all of them from the examples on this page. */
const NAMED = [
    ['DYRK1A', 0], ['Type 2 diabetes', 1], ['Harmine', 2], ['LRRK2 G2019S', 3],
    ['mTOR signaling', 4], ['TREM2', 0], ["Parkinson's disease", 1], ['Metformin', 2],
];

/* The scroll timeline, as fractions of the scene's progress. */
export const FIELD_TIMELINE = {
    gather: [0.22, 0.5],
    nodes: [0.3, 0.48],
    labels: [0.44, 0.56],
    link: [0.56, 0.86],
};

const mulberry32 = (seed) => {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const buildField = (dense) => {
    const random = mulberry32(20261104);
    const nodeCount = dense ? 72 : 48;
    const nodes = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nodeCount; i += 1) {
        const y = 1 - (2 * (i + 0.5)) / nodeCount;
        const radius = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const r = 0.82 + random() * 0.3;
        nodes.push({
            x: Math.cos(theta) * radius * r,
            y: y * r * 0.92,
            z: Math.sin(theta) * radius * r,
            size: 0.45 + random() * 0.55,
            type: i % FIELD_TYPES.length,
            label: null,
        });
    }
    // Spread the names round the sphere so some face the reader at any angle.
    NAMED.forEach(([label, type], index) => {
        const slot = Math.floor(((index + 0.5) / NAMED.length) * nodeCount);
        let pick = slot;
        while (nodes[pick].type !== type) pick = (pick + 1) % nodeCount;
        nodes[pick].label = label;
        nodes[pick].size = 1;
    });

    const edges = [];
    const seen = new Set();
    const addEdge = (a, b) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (a === b || seen.has(key)) return;
        seen.add(key);
        edges.push([a, b]);
    };
    nodes.forEach((node, i) => {
        const nearest = nodes
            .map((other, j) => [j, (other.x - node.x) ** 2 + (other.y - node.y) ** 2 + (other.z - node.z) ** 2])
            .filter(([j]) => j !== i)
            .sort((left, right) => left[1] - right[1])
            .slice(0, 2 + Math.floor(random() * 2));
        nearest.forEach(([j]) => addEdge(i, j));
    });
    for (let k = 0; k < nodeCount / 6; k += 1) {
        addEdge(Math.floor(random() * nodeCount), Math.floor(random() * nodeCount));
    }
    // Draw in from one side of the sphere to the other rather than all at once.
    edges.sort((left, right) => (nodes[left[0]].x + nodes[left[1]].x) - (nodes[right[0]].x + nodes[right[1]].x));

    const particleCount = dense ? 900 : 420;
    const particles = [];
    for (let i = 0; i < particleCount; i += 1) {
        const node = nodes[i % nodeCount];
        const spread = 0.05 + random() * 0.07;
        particles.push({
            sx: (random() * 2 - 1) * 1.9,
            sy: (random() * 2 - 1) * 1.15,
            sz: (random() * 2 - 1) * 0.55,
            tx: node.x + (random() * 2 - 1) * spread,
            ty: node.y + (random() * 2 - 1) * spread,
            tz: node.z + (random() * 2 - 1) * spread,
            phase: random() * Math.PI * 2,
            delay: random() * 0.35,
        });
    }
    return { nodes, edges, particles };
};

const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${alpha.toFixed(3)})`;

export const createKnowledgeField = (canvas, { dense = true } = {}) => {
    let context = null;
    try {
        context = canvas.getContext('2d');
    } catch (error) {
        context = null;
    }
    if (!context) return null;
    const { nodes, edges, particles } = buildField(dense);
    const projected = nodes.map(() => ({ x: 0, y: 0, z: 0, scale: 1 }));
    let width = 0;
    let height = 0;
    let ratio = 1;

    const resize = (cssWidth, cssHeight) => {
        ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = cssWidth;
        height = cssHeight;
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
    };

    const draw = (progress, time = 0) => {
        if (!width || !height) return;
        const ctx = context;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const gather = easeInOut(segment(progress, ...FIELD_TIMELINE.gather));
        const grow = easeOut(segment(progress, ...FIELD_TIMELINE.nodes));
        const named = segment(progress, ...FIELD_TIMELINE.labels);
        const link = segment(progress, ...FIELD_TIMELINE.link);
        const idle = time * 0.00006;
        const angle = -0.6 + progress * 2.6 + idle;
        const tilt = -0.3 + gather * 0.12;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const radius = Math.min(width * 0.36, height * 0.4);
        const camera = 3.4;
        const cx = width / 2;
        const cy = height / 2;

        const project = (x, y, z, out) => {
            const rx = x * cosA + z * sinA;
            const rz = -x * sinA + z * cosA;
            const ry = y * cosT - rz * sinT;
            const depth = y * sinT + rz * cosT;
            const scale = camera / (camera + depth);
            out.x = cx + rx * radius * scale;
            out.y = cy + ry * radius * scale;
            out.z = depth;
            out.scale = scale;
            return out;
        };

        nodes.forEach((node, i) => project(node.x, node.y, node.z, projected[i]));

        // Relationships, drawn in once the terms have formed.
        if (link > 0) {
            ctx.lineWidth = 1;
            edges.forEach(([a, b], index) => {
                const local = clamp01(link * 1.7 - (index / edges.length) * 0.7);
                if (local <= 0) return;
                const from = projected[a];
                const to = projected[b];
                const front = clamp01(0.55 - (from.z + to.z) * 0.35);
                ctx.strokeStyle = `rgba(122,173,251,${(0.12 + front * 0.38).toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(from.x + (to.x - from.x) * local, from.y + (to.y - from.y) * local);
                ctx.stroke();
                // Evidence travelling along a finished edge.
                if (local >= 1 && time && index % 3 === 0) {
                    const f = ((time * 0.00025) + index * 0.137) % 1;
                    ctx.fillStyle = `rgba(190,215,255,${(0.35 + front * 0.5).toFixed(3)})`;
                    ctx.fillRect(from.x + (to.x - from.x) * f - 1, from.y + (to.y - from.y) * f - 1, 2, 2);
                }
            });
        }

        // Papers: a drifting sheet that streams into the terms it mentions.
        if (gather < 1) {
            const point = { x: 0, y: 0, z: 0, scale: 1 };
            particles.forEach((particle) => {
                const t = easeInOut(clamp01((gather - particle.delay * 0.5) / 0.75));
                const drift = Math.sin(particle.phase + time * 0.0007) * 0.025 * (1 - t);
                project(
                    particle.sx + (particle.tx - particle.sx) * t,
                    particle.sy + (particle.ty - particle.sy) * t + drift,
                    particle.sz + (particle.tz - particle.sz) * t,
                    point,
                );
                const alpha = (0.28 + clamp01(0.5 - point.z * 0.4) * 0.4) * (1 - segment(t, 0.75, 1));
                if (alpha <= 0.01) return;
                ctx.fillStyle = `rgba(203,210,224,${alpha.toFixed(3)})`;
                const w = 2.2 * point.scale;
                ctx.fillRect(point.x - w / 2, point.y - w * 0.65, w, w * 1.3);
            });
        }

        // Terms, back to front.
        if (grow > 0) {
            const order = projected.map((p, i) => i).sort((a, b) => projected[b].z - projected[a].z);
            order.forEach((i) => {
                const node = nodes[i];
                const p = projected[i];
                const color = FIELD_TYPES[node.type].color;
                const front = clamp01(0.6 - p.z * 0.45);
                const r = (2.2 + node.size * 5.2) * p.scale * grow;
                ctx.fillStyle = rgba(color, 0.12 * front * grow);
                ctx.beginPath();
                ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = rgba(color, (0.45 + front * 0.55) * grow);
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            });

            if (named > 0) {
                ctx.font = '500 12px Geist, sans-serif';
                ctx.textBaseline = 'middle';
                nodes.forEach((node, i) => {
                    if (!node.label) return;
                    const p = projected[i];
                    const facing = clamp01((0.15 - p.z) * 2.2);
                    const alpha = named * facing;
                    if (alpha <= 0.02) return;
                    const r = (2.2 + node.size * 5.2) * p.scale;
                    const textWidth = ctx.measureText(node.label).width;
                    // Flip to the node's left rather than run off the canvas.
                    const x = p.x + r + 7 + textWidth + 8 > width ? p.x - r - 7 - textWidth : p.x + r + 7;
                    ctx.fillStyle = `rgba(11,18,32,${(0.72 * alpha).toFixed(3)})`;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(x - 6, p.y - 10, textWidth + 12, 20, 6);
                    else ctx.rect(x - 6, p.y - 10, textWidth + 12, 20);
                    ctx.fill();
                    ctx.fillStyle = `rgba(242,244,248,${alpha.toFixed(3)})`;
                    ctx.fillText(node.label, x, p.y + 0.5);
                });
            }
        }
    };

    return { resize, draw };
};
