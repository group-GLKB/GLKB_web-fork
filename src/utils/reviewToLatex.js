/**
 * A finished literature review (markdown) -> a LaTeX document you can compile.
 *
 * The reviews have a narrow, predictable shape — `# title`, `## section`, prose paragraphs whose
 * findings carry `[3]` or `[3, 7]` citations, and a `## References` list of
 * `3. Title. (2024). PMID 37875462.` — so the conversion is a line-by-line pass rather than a
 * markdown parser. What makes the output worth having over the raw text is that the numbered
 * citations become real `\cite{}` keys against a `thebibliography` environment: renumber,
 * reorder or drop a reference and LaTeX keeps the text consistent.
 *
 * Deliberately a plain `article` with no custom packages, so it compiles anywhere, pdflatex
 * included. Everything else about it is the review's own.
 */

/**
 * Non-ASCII characters, mapped to commands a bare pdflatex understands.
 *
 * This is what a real review contains, counted over two finished ones (5,800 words each): 70 beta,
 * 19 alpha, then gamma, omega, mu, kappa, lambda, a superscript two, a minus sign and one >=. A
 * bare pdflatex reads the file as UTF-8 but has no glyph for any of them, and the failure is
 * FATAL -- "Unicode character beta not set up for use with LaTeX", no PDF at all. Math mode is
 * used rather than textgreek/unicode-math because it needs no package that a minimal TeX Live
 * might not have.
 */
const GREEK = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega'.split(' ');
const UNICODE = {
    ...Object.fromEntries(GREEK.map((name, i) => [
        String.fromCharCode(0x3b1 + i), name === 'sigmaf' ? '$\\varsigma$' : `$\\${name}$`,
    ])),
    ...Object.fromEntries('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma2 Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ')
        .map((name, i) => [String.fromCharCode(0x391 + i), /^(Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)$/.test(name) ? `$\\${name}$` : name[0] === 'S' && name.endsWith('2') ? '' : name.replace(/\d/, '')])
        .filter(([, v]) => v)),
    '×': '$\\times$', '÷': '$\\div$', '±': '$\\pm$', '−': '$-$', '≤': '$\\leq$', '≥': '$\\geq$',
    '≈': '$\\approx$', '≠': '$\\neq$', '→': '$\\rightarrow$', '←': '$\\leftarrow$', '↑': '$\\uparrow$',
    '↓': '$\\downarrow$', '∼': '$\\sim$', '°': '$^{\\circ}$', '′': "$'$", '″': "$''$",
    '¹': '$^{1}$', '²': '$^{2}$', '³': '$^{3}$', '½': '$\\frac{1}{2}$', 'µ': '$\\mu$',
    '•': '$\\bullet$', '·': '$\\cdot$', '€': '\\texteuro{}', '£': '\\pounds{}', '©': '\\copyright{}',
    '®': '\\textregistered{}', '™': '\\texttrademark{}', '§': '\\S{}', '¶': '\\P{}', '†': '\\dag{}', '‡': '\\ddag{}',
};

/** Accented Latin letters -> the accent commands, so an author's name survives. */
const ASCII_FOLD = Object.fromEntries(Object.entries({
    '`': 'àèìòùÀÈÌÒÙ', "'": 'áéíóúýÁÉÍÓÚÝ', '^': 'âêîôûÂÊÎÔÛ', '"': 'äëïöüÿÄËÏÖÜ',
    '~': 'ãñõÃÑÕ', 'c': 'çÇ', 'v': 'šžŠŽ', 'u': 'ăĂ', 'H': 'őűŐŰ',
}).flatMap(([accent, chars]) => [...chars].map((ch) => {
    const base = ch.normalize('NFD')[0];
    return [ch, `\\${accent}{${base}}`];
})).concat([['ø', '\\o{}'], ['Ø', '\\O{}'], ['å', '\\aa{}'], ['Å', '\\AA{}'],
    ['æ', '\\ae{}'], ['Æ', '\\AE{}'], ['ß', '\\ss{}'], ['đ', 'd'], ['ı', '\\i{}']]));

/**
 * LaTeX's ten special characters.
 *
 * The backslash goes first, but its replacement contains braces, so it is parked on a sentinel
 * no review can contain until after the braces are escaped — otherwise `\textbackslash{}` comes
 * out as `\textbackslash\{\}` and prints the braces.
 */
const BACKSLASH = '\u0001BS\u0001';
const escapeLatex = (text) => String(text)
    .replace(/\\/g, BACKSLASH)
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    // Characters the reviews actually contain that pdflatex's default (OT1) encoding would drop.
    .replace(/—/g, '---')
    .replace(/–/g, '--')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '\\ldots{}')
    .replace(/[\u00a0\u2009\u2005\u200a\u202f]/g, ' ')   // the spaces a copy-paste leaves behind
    // \u0080 upward, so the sentinel above (a control character) is never touched here
    .replace(/[\u0080-￿]/g, (ch) => UNICODE[ch] || ASCII_FOLD[ch] || `[U+${ch.codePointAt(0).toString(16).toUpperCase()}]`)
    .split(BACKSLASH).join('\\textbackslash{}');

/** `**bold**`, `*italic*` and `` `code` `` survive as LaTeX; everything else is escaped text. */
const inlineMarkup = (text) => escapeLatex(text)
    .replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1\\textit{$2}')
    .replace(/`([^`]+)`/g, '\\texttt{$1}');

/** `[3]` / `[3, 7]` -> `\cite{ref3}` / `\cite{ref3,ref7}`, but only for numbers that are cited. */
const citations = (text, known) => text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (whole, inner) => {
    const nums = inner.split(',').map((n) => n.trim());
    if (!nums.every((n) => known.has(n))) return whole;   // not a reference number; leave it alone
    return `\\cite{${nums.map((n) => `ref${n}`).join(',')}}`;
});

/**
 * `3. Title. (2024). PMID 37875462.` -> {num, text}. A line that does not match that shape is
 * still kept, with whatever text it has, so nothing is silently dropped: the continuation of the
 * entry above. A list with no numbers at all (an author-date style, LiteratureReview/citationStyle.js)
 * is one entry per blank-line-separated paragraph.
 */
const parseReferences = (lines) => {
    const out = [];
    const numbered = lines.some((raw) => /^(\d+)\.\s+/.test(raw));
    let afterBlank = true;
    lines.forEach((raw) => {
        const m = raw.match(/^(\d+)\.\s+(.*)$/);
        if (m) {
            out.push({ num: m[1], text: m[2].trim() });
        } else if (raw.trim()) {
            if (!numbered && afterBlank) out.push({ num: null, text: raw.trim() });
            else if (!out.length) return;
            else out[out.length - 1].text += ` ${raw.trim()}`;   // a wrapped entry
        }
        afterBlank = !raw.trim();
    });
    return out;
};

const bibliography = (refs) => {
    if (!refs.length) return '';
    // An author-date list: no numbers, alphabetical, each entry with a hanging indent.
    if (refs.some((r) => r.num === null)) {
        const items = refs.map((r) => `\\item ${inlineMarkup(r.text)}`).join('\n');
        return `\\section*{References}\n\\begin{list}{}{\\leftmargin=2em \\itemindent=-2em \\itemsep=4pt}\n${items}\n\\end{list}\n`;
    }
    // `widest label` sizes the numbers column; the longest number is the widest label.
    const widest = refs[refs.length - 1].num;
    const items = refs.map((r) => {
        const pmid = (r.text.match(/PMID:?\s+(\d+)/) || [])[1];
        const body = inlineMarkup(r.text);
        // The PMID becomes a link target people can paste; \url would need hyperref, so it stays text.
        return `\\bibitem{ref${r.num}} ${body}${pmid ? `\n  % https://pubmed.ncbi.nlm.nih.gov/${pmid}` : ''}`;
    }).join('\n\n');
    return `\\begin{thebibliography}{${widest}}\n\n${items}\n\n\\end{thebibliography}\n`;
};

/** A markdown table -> tabular. The reviews rarely contain one; a broken one is left as text. */
const table = (rows) => {
    const cells = rows
        .filter((r) => !/^\|[\s|:-]+\|?$/.test(r.trim()))        // the alignment row
        .map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inlineMarkup(c.trim())));
    if (!cells.length) return '';
    const cols = Math.max(...cells.map((c) => c.length));
    const body = cells.map((c) => `${c.join(' & ')} \\\\`).join('\n');
    return `\\begin{center}\n\\begin{tabular}{${'l'.repeat(cols)}}\n\\hline\n${body}\n\\hline\n\\end{tabular}\n\\end{center}\n`;
};

/**
 * @param {string} markdown  the review as the agent wrote it
 * @param {{title?: string, date?: Date}} [opts]  title when the markdown has no `# ` line
 * @returns {string} a complete .tex document
 */
export function reviewToLatex(markdown, opts = {}) {
    // The renderer appends an audit comment (`<!-- words 5844 / target 6000 ... -->`); it can land
    // after the references, so it is stripped from the whole document rather than per prose line.
    const lines = String(markdown || '').replace(/<!--[\s\S]*?-->/g, '').split('\n');

    // Split off the references first: everything after them is the bibliography, not prose.
    const refAt = lines.findIndex((l) => /^##\s+References\s*$/i.test(l));
    const bodyLines = refAt < 0 ? lines : lines.slice(0, refAt);
    const refs = refAt < 0 ? [] : parseReferences(lines.slice(refAt + 1));
    const known = new Set(refs.map((r) => r.num));

    let title = opts.title || '';
    const out = [];
    let paragraph = [];
    let tableRows = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        out.push(citations(inlineMarkup(paragraph.join(' ')), known), '');
        paragraph = [];
    };
    const flushTable = () => {
        if (!tableRows.length) return;
        out.push(table(tableRows));
        tableRows = [];
    };
    const flush = () => { flushParagraph(); flushTable(); };

    bodyLines.forEach((raw) => {
        const line = raw.trimEnd();
        if (/^\|/.test(line.trim())) { flushParagraph(); tableRows.push(line); return; }
        flushTable();

        if (!line.trim()) { flushParagraph(); return; }

        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
            flushParagraph();
            const text = citations(inlineMarkup(h[2].trim()), known);
            if (h[1].length === 1) { title = title || h[2].trim(); return; }   // the document title
            out.push(`\\${['section', 'subsection', 'subsubsection'][h[1].length - 2] || 'paragraph'}{${text}}`, '');
            return;
        }

        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
        if (bullet || numbered) {
            flushParagraph();
            const env = bullet ? 'itemize' : 'enumerate';
            const item = `\\item ${citations(inlineMarkup((bullet || numbered)[1]), known)}`;
            // Keep consecutive items in one environment rather than opening a new one per line.
            if (out[out.length - 1] === `\\end{${env}}`) out.pop();
            else out.push(`\\begin{${env}}`);
            out.push(item, `\\end{${env}}`, '');
            // the blank line sits after \end; drop it while more items may follow
            if (out[out.length - 1] === '') out.pop();
            return;
        }

        paragraph.push(line.trim());
    });
    flush();

    const date = opts.date || new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return [
        '% Written by GLKB (glkb.org). For research use only; verify every citation against the source.',
        '\\documentclass[11pt]{article}',
        '\\usepackage[utf8]{inputenc}',
        '\\usepackage[margin=1in]{geometry}',
        '',
        `\\title{${inlineMarkup(title || 'Literature review')}}`,
        '\\author{Generated with GLKB}',
        `\\date{${stamp}}`,
        '',
        '\\begin{document}',
        '\\maketitle',
        '',
        out.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        '',
        bibliography(refs),
        '\\end{document}',
        '',
    ].join('\n');
}

/** A filename-safe slug of the topic, for the download. */
export const latexFilename = (title, date = new Date()) => {
    const slug = String(title || 'literature-review')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'literature-review';
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return `${slug}_${stamp}.tex`;
};

export default reviewToLatex;
