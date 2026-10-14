/**
 * The Word and print/PDF exports (utils/reviewExport.js).
 *
 * Both are HTML, so the failures worth pinning are the ones that still look like a document when
 * they are wrong: a reference list renumbered from 1 so the numbers disagree with the [12] in the
 * text, the title printed twice, or a stray `<` from the prose closing a tag.
 *
 * Checked outside jest as well, on the 5,844-word review from dev: macOS `textutil` converts the
 * .doc to a real .docx with 8,164 of the markdown's 8,173 words and all 146 PMIDs, and Chromium
 * prints the print view to a 28-page PDF.
 */
import {
    exportFilename, reviewTitle, reviewToHtml, reviewToPrintable, reviewToWord,
} from './reviewExport';

const REVIEW = `# Sequence-defined polymers for predictable gene delivery

## Structural precision

Precision covers monomer order and chain length [1, 2]. Transfection reached 60% in HEK293T [12].

Hold composition fixed and vary **only** the order.

## References

1. A paper. (2024). PMID 37875462.
2. Another paper. (2019). PMID 30969752.
12. A twelfth paper. (2018). PMID 30216690.
`;

describe('the body', () => {
    it('keeps the heading levels and the prose', () => {
        const html = reviewToHtml(REVIEW);
        expect(html).toContain('<h2>Structural precision</h2>');
        expect(html).toContain('<strong>only</strong>');
        expect(html).toMatch(/<p>Precision covers monomer order and chain length \[1, 2\]\./);
    });

    it('does not print the title twice', () => {
        // The wrapper prints the `# ` line as the document title; emitting it in the body as well
        // put it in the Word file twice, which the docx conversion showed.
        expect(reviewToHtml(REVIEW)).not.toContain('<h1>');
        expect((reviewToWord(REVIEW).match(/Sequence-defined polymers for predictable gene delivery/g) || []))
            .toHaveLength(2);   // the <title> and the <h1>, not a third in the body
    });

    it('keeps the reference numbers the text cites, rather than renumbering them', () => {
        // An <ol> renumbers 1, 2, 12 to 1, 2, 3 and the [12] in the prose then points at nothing.
        const html = reviewToHtml(REVIEW);
        expect(html).not.toMatch(/<ol>[\s\S]*A twelfth paper/);
        expect(html).toContain('<span class="refnum">12.</span> A twelfth paper.');
    });

    it('escapes HTML that arrives in the prose', () => {
        const html = reviewToHtml('# T\n\nLevels < 5 & > 2 in <b>bold</b> text.\n');
        expect(html).toContain('&lt; 5 &amp; &gt; 2');
        expect(html).toContain('&lt;b&gt;');       // not an actual tag
        expect(html).not.toContain('<b>');
    });

    it('renders lists and tables', () => {
        expect(reviewToHtml('# T\n\n- one\n- two\n')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
        const table = reviewToHtml('# T\n\n| Gene | N |\n|---|---:|\n| TP53 | 8,532 |\n');
        expect(table).toContain('<th>Gene</th>');
        expect(table).toContain('<td>TP53</td>');
        expect(table).not.toContain('---');
    });

    it('drops the audit comment, and survives an empty review', () => {
        expect(reviewToHtml(`${REVIEW}\n<!-- words 5844 / target 6000 -->\n`)).not.toContain('5844');
        expect(reviewToHtml('')).toBe('');
        expect(reviewToWord(null)).toContain('</html>');
    });
});

describe('the Word document', () => {
    it('declares what Word needs to open it as a document', () => {
        const doc = reviewToWord(REVIEW);
        expect(doc).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
        expect(doc).toContain('content="Word.Document"');
        expect(doc.startsWith('<!DOCTYPE html>')).toBe(true);
    });

    it('carries the title, the notice and every reference', () => {
        const doc = reviewToWord(REVIEW);
        expect(doc).toContain('<title>Sequence-defined polymers for predictable gene delivery</title>');
        expect(doc).toContain('For research use only');
        expect((doc.match(/PMID/g) || [])).toHaveLength(3);
    });
});

describe('the print view', () => {
    it('is a plain page with print rules, and no Word markup', () => {
        const page = reviewToPrintable(REVIEW);
        expect(page).toContain('@media print');
        expect(page).toContain('page-break-after: avoid');   // a heading never ends a page alone
        expect(page).toContain('orphans: 3');
        expect(page).not.toContain('urn:schemas-microsoft-com');
    });
});

describe('titles and filenames', () => {
    it('takes the title from the markdown, else the topic', () => {
        expect(reviewTitle(REVIEW)).toBe('Sequence-defined polymers for predictable gene delivery');
        expect(reviewTitle('No heading here.', 'My topic')).toBe('My topic');
        expect(reviewTitle('', '')).toBe('Literature review');
    });

    it('is a dated slug with the right extension', () => {
        const d = new Date(2026, 9, 6);
        expect(exportFilename('CRISPR base editing', 'doc', d)).toBe('crispr-base-editing_2026-10-06.doc');
        expect(exportFilename('../../etc/passwd', 'doc', d)).toBe('etc-passwd_2026-10-06.doc');
        expect(exportFilename('', 'doc', d)).toBe('literature-review_2026-10-06.doc');
    });
});

it('gives an author–year reference list its hanging indent', () => {
    const html = reviewToHtml('# T\n\nA claim (Lee, 2021).\n\n## References\n\nLee, A. (2021). Paper one.\n\nPark, B. (2019). Paper two.\n');
    expect(html.match(/<p class="ref">/g)).toHaveLength(2);
    expect(html).toContain('<p>A claim (Lee, 2021).</p>');
});
