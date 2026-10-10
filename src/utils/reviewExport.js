/**
 * A finished literature review (markdown) -> Word, or a print view the browser turns into a PDF.
 *
 * Both are HTML, which is why they are in one file: Word has opened HTML saved as `.doc` since
 * Word 2000, and a print stylesheet is what the browser's own PDF writer renders. Neither needs a
 * library — jsPDF would hand-break lines across a 6,000-word, 20-page review with no hyphenation
 * or widow control, and `docx` would add half a megabyte to a 45-dependency app to emit a document
 * Word opens either way. For a typeset PDF the .tex export (utils/reviewToLatex.js) is the better
 * path; this one is for a reader who wants the file now.
 *
 * Citations stay as the text has them — `[1, 2]`, or "(Lee et al., 2021)" once a citation style
 * has been applied (LiteratureReview/citationStyle.js): neither format has LaTeX's reference
 * machinery, so the citations and the list are kept as text and stay consistent as long as neither
 * is edited.
 */

const escapeHtml = (text) => String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (text) => escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

/** The review's body, as HTML. Headings, paragraphs, lists, tables and the reference list. */
export function reviewToHtml(markdown) {
    const lines = String(markdown || '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
    const out = [];
    let paragraph = [];
    let list = null;          // 'ul' | 'ol'
    let tableRows = [];

    let inReferences = false;
    const flushParagraph = () => {
        // An unnumbered entry of an author-date reference list (LiteratureReview/citationStyle.js)
        // takes the list's hanging indent too.
        if (paragraph.length) out.push(`<p${inReferences ? ' class="ref"' : ''}>${inline(paragraph.join(' '))}</p>`);
        paragraph = [];
    };
    const flushList = () => {
        if (list) out.push(`</${list}>`);
        list = null;
    };
    const flushTable = () => {
        if (!tableRows.length) return;
        const cells = tableRows
            .filter((r) => !/^\|[\s|:-]+\|?$/.test(r.trim()))
            .map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())));
        const [head, ...body] = cells;
        out.push([
            '<table>',
            head ? `<thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` : '',
            `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`,
            '</table>',
        ].join(''));
        tableRows = [];
    };
    const flush = () => { flushParagraph(); flushList(); flushTable(); };

    lines.forEach((raw) => {
        const line = raw.trimEnd();

        if (/^\|/.test(line.trim())) { flushParagraph(); flushList(); tableRows.push(line); return; }
        flushTable();

        if (!line.trim()) { flushParagraph(); return; }

        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
            flush();
            inReferences = /^references\s*$/i.test(h[2].trim());
            // The `# ` line is the document title, which the wrapper already prints; emitting it
            // here too put it in the file twice (seen in the Word export before this).
            if (h[1].length === 1) return;
            out.push(`<h${h[1].length}>${inline(h[2].trim())}</h${h[1].length}>`);
            return;
        }

        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        // Inside References the numbers are the reference ids and must show exactly as written;
        // an <ol> would renumber them from 1 and silently disagree with the [12] in the text.
        if (numbered && inReferences) {
            flushParagraph(); flushList();
            out.push(`<p class="ref"><span class="refnum">${escapeHtml(numbered[1])}.</span> ${inline(numbered[2])}</p>`);
            return;
        }
        if (bullet || numbered) {
            flushParagraph();
            const want = bullet ? 'ul' : 'ol';
            if (list !== want) { flushList(); out.push(`<${want}>`); list = want; }
            out.push(`<li>${inline((bullet || numbered)[bullet ? 1 : 2])}</li>`);
            return;
        }

        flushList();
        paragraph.push(line.trim());
    });
    flush();
    return out.join('\n');
}

/** The title: the markdown's `# ` line, else what the caller knows the topic to be. */
export const reviewTitle = (markdown, fallback = 'Literature review') => {
    const m = String(markdown || '').match(/^#\s+(.+)$/m);
    return (m ? m[1] : fallback || '').trim() || 'Literature review';
};

const STYLE = `
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.55;
         color: #111; max-width: 46em; margin: 0 auto; padding: 2em 1.5em; }
  h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 .15em; }
  h2 { font-size: 14pt; margin: 1.6em 0 .5em; }
  h3 { font-size: 12.5pt; margin: 1.3em 0 .4em; }
  p { margin: 0 0 .85em; text-align: justify; }
  p.ref { margin: 0 0 .45em 2.2em; text-indent: -2.2em; font-size: 10.5pt; }
  .refnum { display: inline-block; min-width: 1.9em; }
  .byline { color: #555; font-size: 10pt; margin: 0 0 2em; }
  table { border-collapse: collapse; margin: 1em 0; font-size: 10.5pt; }
  th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
  @page { margin: 2cm; }
  @media print {
    body { max-width: none; padding: 0; }
    h1, h2, h3 { page-break-after: avoid; }
    p, li { orphans: 3; widows: 3; }
  }
`;

const shell = (title, byline, body, extraHead = '') => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${extraHead}
<style>${STYLE}</style></head>
<body><h1>${escapeHtml(title)}</h1><p class="byline">${escapeHtml(byline)}</p>
${body}
</body></html>`;

const byline = (date) => `Generated with GLKB · ${date.toISOString().slice(0, 10)} · `
    + 'For research use only; verify every citation against the source.';

/**
 * A Word document. It is HTML with Word's namespaces declared, which is what Word writes itself
 * when it saves as "Web Page", and what it opens as a document rather than as a web page. Pages,
 * Google Docs and LibreOffice open it too; from Word, "Save As .docx" converts it.
 */
export function reviewToWord(markdown, opts = {}) {
    const body = reviewToHtml(markdown);
    const title = reviewTitle(markdown, opts.title);
    const head = '<meta name="ProgId" content="Word.Document">'
        + '<meta name="Generator" content="Microsoft Word 15">'
        + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->';
    return shell(title, byline(opts.date || new Date()), body, head)
        .replace('<html>', '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
            + 'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
}

/** The same document, styled for the browser's print dialog -> "Save as PDF". */
export function reviewToPrintable(markdown, opts = {}) {
    const body = reviewToHtml(markdown);
    const title = reviewTitle(markdown, opts.title);
    return shell(title, byline(opts.date || new Date()), body);
}

/** `<slug>_<date>.<ext>`, the same shape the .tex export uses. */
export const exportFilename = (title, ext, date = new Date()) => {
    const slug = String(title || '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'literature-review';
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return `${slug}_${stamp}.${ext}`;
};
