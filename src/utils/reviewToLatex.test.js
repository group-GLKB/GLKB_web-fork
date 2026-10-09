/**
 * The LaTeX export (utils/reviewToLatex.js).
 *
 * The thing worth pinning is not the formatting but that the output COMPILES and says the same
 * thing as the review: an unescaped `%` comments the rest of a line out, an unescaped `&` is a
 * fatal error, and a `\cite{}` to a key no `\bibitem` defines prints as `[?]`. Each of those is
 * a way for the file to be wrong in a way a glance at it would not show.
 */
import { latexFilename, reviewToLatex } from './reviewToLatex';

const REVIEW = `# Sequence-defined polymers for predictable gene delivery

## Structural precision comprises distinct design dimensions

Precision covers monomer order, chain length and end groups [1, 2]. Solid-phase synthesis
delivers both [3]. Transfection reached 60% in HEK293T [2].

## What decisive studies should do next

Hold composition fixed and vary **only** the order [1].

## References

1. Precision Sequence-Defined Polymers. (2024). PMID 37875462.
2. Amphiphilic Polymer-Oligonucleotide Nanomaterials. (2019). PMID 30969752.
3. Solid-Phase Strategies towards Sequence-Defined Macromolecules. (2018). PMID 30216690.
`;

const tex = (md = REVIEW, opts) => reviewToLatex(md, opts);

describe('the document', () => {
    it('is a complete, self-contained article', () => {
        const out = tex();
        expect(out).toContain('\\documentclass[11pt]{article}');
        expect(out.indexOf('\\begin{document}')).toBeLessThan(out.indexOf('\\end{document}'));
        // no package beyond what pdflatex ships with, so it compiles anywhere
        expect(out.match(/\\usepackage(\[[^\]]*\])?\{(\w+)\}/g)).toEqual(
            ['\\usepackage[utf8]{inputenc}', '\\usepackage[margin=1in]{geometry}'],
        );
    });

    it('takes its title from the markdown, and the sections from the headings', () => {
        const out = tex();
        expect(out).toContain('\\title{Sequence-defined polymers for predictable gene delivery}');
        expect(out).toContain('\\section{Structural precision comprises distinct design dimensions}');
        expect(out).toContain('\\section{What decisive studies should do next}');
        // the h1 is the title, never also a section
        expect(out).not.toContain('\\section{Sequence-defined polymers');
    });

    it('falls back to the topic when the markdown has no title line', () => {
        expect(tex('Some prose.', { title: 'My topic' })).toContain('\\title{My topic}');
    });
});

describe('citations', () => {
    it('become \\cite keys, grouped as they were written', () => {
        const out = tex();
        expect(out).toContain('\\cite{ref1,ref2}');
        expect(out).toContain('\\cite{ref3}');
        expect(out).not.toMatch(/\[1, 2\]/);
    });

    it('resolve: every key cited has a bibitem', () => {
        const out = tex();
        const cited = new Set([...out.matchAll(/\\cite\{([^}]+)\}/g)].flatMap((m) => m[1].split(',')));
        const defined = new Set([...out.matchAll(/\\bibitem\{([^}]+)\}/g)].map((m) => m[1]));
        expect(cited.size).toBeGreaterThan(0);
        [...cited].forEach((key) => expect(defined.has(key)).toBe(true));
    });

    it('leaves a bracketed number that is not a reference alone', () => {
        // "[99]" with only three references is not a citation; turning it into \cite{ref99}
        // would compile to a dangling [?].
        const out = tex(REVIEW.replace('in HEK293T [2]', 'in HEK293T [99]'));
        expect(out).toContain('[99]');
        expect(out).not.toContain('ref99');
    });

    it('keeps the references in order with their PMIDs', () => {
        const out = tex();
        expect(out).toContain('\\begin{thebibliography}{3}');
        expect(out).toMatch(/\\bibitem\{ref1\} Precision Sequence-Defined Polymers\. \(2024\)\. PMID 37875462\./);
        expect(out).toContain('% https://pubmed.ncbi.nlm.nih.gov/37875462');
    });
});

describe('escaping — each of these breaks the build or changes the meaning', () => {
    it('escapes the characters LaTeX reserves', () => {
        const out = tex('# T\n\nEditing rose 60% & cost $5 for item_1 {x} #2 ~a ^b.\n');
        const body = out.split('\\maketitle')[1];
        expect(body).toContain('60\\%');          // unescaped: comments out the rest of the line
        expect(body).toContain('\\&');            // unescaped: "misplaced alignment tab" error
        expect(body).toContain('\\$5');
        expect(body).toContain('item\\_1');
        expect(body).toContain('\\{x\\}');
        expect(body).toContain('\\#2');
        expect(body).toContain('\\textasciitilde{}a');
        expect(body).toContain('\\textasciicircum{}b');
    });

    it('escapes a backslash without creating a command', () => {
        expect(tex('# T\n\nA \\ B.\n')).toContain('\\textbackslash{}');
    });

    it('maps the Greek letters, which a bare pdflatex dies on', () => {
        // Measured over two finished reviews: 70 beta, 19 alpha, then gamma/omega/mu/kappa/lambda.
        // Left as UTF-8 these are a FATAL error ("not set up for use with LaTeX"), no PDF at all.
        const body = tex('# T\n\nPoly(β-amino esters) with α and γ, 2 μM, NF-κB, λ, Ω.\n').split('\\maketitle')[1];
        expect(body).toContain('$\\beta$');
        expect(body).toContain('$\\alpha$');
        expect(body).toContain('$\\gamma$');
        expect(body).toContain('$\\mu$');
        expect(body).toContain('$\\kappa$');
        expect(body).toContain('$\\lambda$');
        expect(body).toContain('$\\Omega$');
        expect(body).not.toMatch(/[\u0370-\u03ff]/);     // nothing Greek survives as a raw glyph
    });

    it('maps the symbols and accents a biomedical review carries', () => {
        const body = tex('# T\n\n≥5 °C, 10×, ±2, −3, 5 cm², naïve, Müller, Lübeck.\n').split('\\maketitle')[1];
        expect(body).toContain('$\\geq$');
        expect(body).toContain('$^{\\circ}$');
        expect(body).toContain('$\\times$');
        expect(body).toContain('$\\pm$');
        expect(body).toContain('$^{2}$');
        expect(body).toContain('na\\"{i}ve');
        expect(body).toContain('M\\"{u}ller');
    });

    it('leaves nothing unmapped above ASCII, whatever arrives', () => {
        const out = tex('# T\n\nA ☃ and a 気.\n');
        expect(out).not.toMatch(/[\u0080-\uffff]/);       // every one became a command or a marker
        expect(out).toContain('[U+2603]');                 // and an unknown one is visible, not dropped
    });

    it('converts the punctuation the reviews actually contain', () => {
        const body = tex('# T\n\nA—b – c “q” ‘r’ and…\n').split('\\maketitle')[1];
        expect(body).toContain('A---b');
        expect(body).toContain('-- c');
        expect(body).toContain('"q"');
        expect(body).toContain("'r'");
        expect(body).toContain('\\ldots{}');
    });
});

describe('inline markup and blocks', () => {
    it('keeps bold and italic', () => {
        const out = tex();
        expect(out).toContain('\\textbf{only}');
        expect(tex('# T\n\nAn *emphasis* here.\n')).toContain('\\textit{emphasis}');
    });

    it('joins a wrapped paragraph into one', () => {
        // the markdown wraps mid-sentence; LaTeX must see one paragraph, not a broken line
        const body = tex().split('\\maketitle')[1];
        expect(body).toMatch(/Precision covers monomer order, chain length and end groups \\cite\{ref1,ref2\}\. Solid-phase synthesis delivers both/);
    });

    it('makes a list one environment, not one per item', () => {
        const out = tex('# T\n\n- first\n- second\n- third\n');
        expect((out.match(/\\begin\{itemize\}/g) || []).length).toBe(1);
        expect((out.match(/\\item /g) || []).length).toBe(3);
        expect((out.match(/\\end\{itemize\}/g) || []).length).toBe(1);
    });

    it('turns a markdown table into a tabular', () => {
        const out = tex('# T\n\n| Gene | Articles |\n|---|---:|\n| TP53 | 8,532 |\n');
        expect(out).toContain('\\begin{tabular}{ll}');
        expect(out).toContain('TP53 & 8,532 \\\\');
        expect(out).not.toContain('|---|');
    });

    it('drops the audit comment the renderer appends', () => {
        expect(tex(`${REVIEW}\n<!-- words 5844 / target 6000 -->\n`)).not.toContain('words 5844');
    });

    it('survives an empty or missing review', () => {
        expect(reviewToLatex('')).toContain('\\end{document}');
        expect(reviewToLatex(null)).toContain('\\title{Literature review}');
        expect(reviewToLatex('# T\n\nNo references here.\n')).not.toContain('thebibliography');
    });
});

describe('the filename', () => {
    const d = new Date(2026, 9, 6);
    it('is a dated slug of the topic', () => {
        expect(latexFilename('Sequence-defined polymers for delivery', d))
            .toBe('sequence-defined-polymers-for-delivery_2026-10-06.tex');
    });
    it('never comes out empty or with path characters', () => {
        expect(latexFilename('../../etc/passwd', d)).toBe('etc-passwd_2026-10-06.tex');
        expect(latexFilename('***', d)).toBe('literature-review_2026-10-06.tex');
        expect(latexFilename('', d)).toBe('literature-review_2026-10-06.tex');
    });
});
