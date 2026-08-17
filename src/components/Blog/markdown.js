/**
 * The blog's markdown dialect.
 *
 * Articles are plain markdown (GFM tables and lists included) plus three small
 * additions, all of which exist because the Figma frames contain something
 * markdown has no notation for:
 *
 *   ## Heading {#anchor}   an explicit id, so the table-of-contents rail links
 *                          to the same anchors the design names
 *
 *   :::callout Title       the bordered aside
 *   body
 *   :::
 *
 *   :::sample Label        the grey report excerpt in the Investigate article
 *   > note                 an optional note above the excerpt
 *   #### Section           a section heading inside it
 *   body
 *   ---                    everything after the rule is the footer strip
 *   footer
 *   :::
 *
 * Everything else is ordinary markdown handed to react-markdown.
 */

const FENCE = ':::';

/** `[Label](/target)` — how the front matter writes a link. */
const parseLink = (value) => {
    const match = /^\[(.*)\]\((.*)\)$/.exec(value.trim());
    return match ? { label: match[1], to: match[2] } : null;
};

/**
 * The `toc:` key holds an indented markdown list. Nesting is one level deep:
 * a top-level item opens a group, indented items belong to it. Labels that
 * name a passage rather than a heading still carry an anchor, and the rail
 * falls back to the group's anchor when nothing on the page has that id.
 */
const parseToc = (lines) => {
    const groups = [];
    lines.forEach((line) => {
        const match = /^(\s*)-\s+(.*)$/.exec(line);
        if (!match) return;
        const [, indent, rest] = match;
        const link = parseLink(rest);
        if (!link) return;
        const item = { id: link.to.replace(/^#/, ''), label: link.label };
        if (indent.length > 2 && groups.length) {
            groups[groups.length - 1].push({ ...item, child: true });
        } else {
            groups.push([item]);
        }
    });
    return groups;
};

/** Splits `---\nkey: value\n---\n\nbody` into its two halves. */
export const parseFrontMatter = (source) => {
    const text = source.replace(/\r\n/g, '\n');
    if (!text.startsWith('---\n')) return { meta: {}, body: text };

    const end = text.indexOf('\n---\n', 3);
    if (end === -1) return { meta: {}, body: text };

    const meta = {};
    const lines = text.slice(4, end).split('\n');
    for (let index = 0; index < lines.length; index += 1) {
        const match = /^([A-Za-z][\w]*):\s*(.*)$/.exec(lines[index]);
        if (!match) continue;
        const [, key, value] = match;
        if (key === 'toc' && !value) {
            const listed = [];
            while (index + 1 < lines.length && /^\s+-/.test(lines[index + 1])) {
                listed.push(lines[index + 1]);
                index += 1;
            }
            meta.toc = parseToc(listed);
        } else {
            meta[key] = value;
        }
    }
    if (meta.cta) meta.cta = parseLink(meta.cta) || { label: meta.cta, to: '/' };

    return { meta, body: text.slice(end + 5).replace(/^\n+/, '') };
};

/**
 * The grey excerpt: an optional leading blockquote, then body, then whatever
 * follows the closing thematic break.
 */
const parseSample = (label, content) => {
    let rest = content;
    let note = null;

    const quoted = /^((?:>.*\n?)+)/.exec(rest);
    if (quoted) {
        note = quoted[1].split('\n').map((line) => line.replace(/^>\s?/, '')).join('\n').trim();
        rest = rest.slice(quoted[1].length);
    }

    let footer = null;
    const split = rest.lastIndexOf('\n---\n');
    if (split !== -1) {
        footer = rest.slice(split + 5).trim();
        rest = rest.slice(0, split);
    }

    return { type: 'sample', label, note, body: rest.trim(), footer };
};

/**
 * Walks the body and lifts the ::: containers out, leaving runs of ordinary
 * markdown between them. An unclosed container is treated as prose rather than
 * swallowing the rest of the article.
 */
export const parseSegments = (body) => {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const segments = [];
    let buffer = [];

    const flush = () => {
        const content = buffer.join('\n').trim();
        if (content) segments.push({ type: 'markdown', content });
        buffer = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
        const opening = lines[index].startsWith(FENCE)
            && /^:::(\w+)\s*(.*)$/.exec(lines[index]);

        if (!opening) {
            buffer.push(lines[index]);
            continue;
        }

        const close = lines.indexOf(FENCE, index + 1);
        if (close === -1) {
            buffer.push(lines[index]);
            continue;
        }

        const [, name, argument] = opening;
        const content = lines.slice(index + 1, close).join('\n').trim();

        flush();
        if (name === 'sample') {
            segments.push(parseSample(argument.trim(), `${content}\n`));
        } else {
            segments.push({ type: name, title: argument.trim(), content });
        }
        index = close;
    }

    flush();
    return segments;
};

/** `## Text {#anchor}` — the id the rail scrolls to. */
export const HEADING_ID = /\s*\{#([\w-]+)\}\s*$/;

/** Undo the backslashes the prose carries so markdown leaves it alone. */
export const unescape = (text) => text.replace(/\\([\\`*_[\]<>])/g, '$1');

/**
 * The hero: the article's `# Title` and the paragraph under it. They are pulled
 * out of the body because the index page shows them without rendering the
 * article, and because the design lays them out above the prose column.
 */
const takeHero = (segments) => {
    const first = segments[0];
    if (!first || first.type !== 'markdown') return { rest: segments };

    const match = /^#\s+(.+)\n+([\s\S]*?)(?=\n{2}#{2}\s|$)/.exec(first.content);
    if (!match) return { rest: segments };

    const rest = first.content.slice(match[0].length).replace(/^\n+/, '');
    return {
        title: unescape(match[1].trim()),
        lede: unescape(match[2].trim()),
        rest: rest ? [{ ...first, content: rest }, ...segments.slice(1)] : segments.slice(1),
    };
};

export const parseArticle = (source) => {
    const { meta, body } = parseFrontMatter(source);
    const { title, lede, rest } = takeHero(parseSegments(body));
    return {
        ...meta,
        ...(title ? { title, lede } : {}),
        segments: rest,
    };
};

export default parseArticle;
