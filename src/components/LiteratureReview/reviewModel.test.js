import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
    countWords, expandCitation, linkCitations, minutesLeft, parseReview, reviewAudit, stageFill,
} from './reviewModel';
import ReviewDocument from './ReviewDocument';

// The shape a finished review has (glkb-agent literature_review), trimmed.
const REVIEW = [
    '# Does p53 loss cause chemotherapy resistance?',
    '',
    '## Direct loss-of-function evidence',
    '',
    'Deliberate p53 disruption increases resistance to particular agents in selected models [1, 2]. '
        + 'In AML cell lines a CRISPR screen identified TP53 loss among the hits [1].',
    '',
    '## Where the evidence disagrees',
    '',
    'Other settings show sensitization instead [3–4], so the effect is not uniform across models and drugs.',
    '',
    '## References',
    '',
    '1. Targeting cell cycle and apoptosis in AML. (2023). PMID 36400926.',
    '2. p53 deficiency mediates cisplatin resistance. (2024). PMID 38894712.',
    '3. A third paper. (2019). PMID 30804404.',
    '4. A fourth paper. (2021). PMID 33668653.',
    '',
    '<!-- words 48 / target 6000; cited papers 4; fabricated citations 1 -->',
].join('\n');

describe('parseReview', () => {
    const review = parseReview(REVIEW);
    it('reads the title, the sections and the reference list', () => {
        expect(review.title).toBe('Does p53 loss cause chemotherapy resistance?');
        expect(review.sections.map((s) => [s.number, s.title])).toEqual([
            [1, 'Direct loss-of-function evidence'], [2, 'Where the evidence disagrees']]);
        expect(review.references[1]).toEqual({
            number: 2, title: 'p53 deficiency mediates cisplatin resistance', year: 2024,
            pmid: '38894712', url: 'https://pubmed.ncbi.nlm.nih.gov/38894712/' });
    });
    it("takes the pipeline's own audit from the closing comment", () => {
        expect(review.audit).toEqual({ words: 48, target: 6000, cited: 4, fabricated: 1, verified: 3 });
        expect(reviewAudit('# no audit here')).toBeNull();
    });
    it('prefers the references the service returned', () => {
        const given = [{ number: 1, pmid: 99, title: 'Given', year: 2020 }];
        expect(parseReview(REVIEW, given).references).toEqual([{ number: 1, pmid: '99', title: 'Given', year: 2020 }]);
    });
    it('counts the prose only', () => {
        expect(countWords(review)).toBe(39); // citations, headings and references left out
    });
});

describe('citations', () => {
    it('become pill links, and real links are left alone', () => {
        expect(linkCitations('a [1, 2] b [3–5] c [see](https://x.org) [7](https://y)'))
            .toBe('a [1, 2](#cite=1,2) b [3–5](#cite=3,4,5) c [see](https://x.org) [7](https://y)');
        expect(expandCitation('2, 4-6')).toEqual([2, 4, 5, 6]);
    });
});

describe('progress', () => {
    it('fills the stages before the current one and part of it', () => {
        expect(stageFill(57.5, 'synthesis')).toEqual([1, 0.5, 0, 0]);
    });
    it('estimates the time left only once it means something', () => {
        expect(minutesLeft(5, 120)).toBeNull();
        expect(minutesLeft(50, 300)).toBe(5);
    });
});

describe('ReviewDocument', () => {
    const FIRST = 'Deliberate p53 disruption increases resistance to particular agents in selected models [1, 2]. '
        + 'In AML cell lines a CRISPR screen identified TP53 loss among the hits [1].';

    it("shows the audit's numbers and previews a citation; an unsaved review offers no paragraph actions", () => {
        render(<ReviewDocument markdown={REVIEW} meta={{ generated: 'Oct 9, 2026', minutes: 9 }} />);
        expect(screen.getByText('Citations verified').nextSibling).toHaveTextContent('3');
        expect(screen.getByText('Needs review').nextSibling).toHaveTextContent('1');
        expect(screen.getByText('Generated Oct 9, 2026 · 9 min')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Direct loss-of-function evidence/ })).toBeInTheDocument();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'References 1, 2' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('p53 deficiency mediates cisplatin resistance');
        expect(screen.queryByRole('button', { name: 'Rewrite' })).toBeNull();
    });

    const box = (name) => screen.getByRole('textbox', { name });
    const send = (el, value) => {
        if (value != null) fireEvent.change(el, { target: { value } });
        fireEvent.submit(el.closest('form'));
    };

    it('rewrites a paragraph the way the reader says, revises it, and replaces it only when accepted', async () => {
        const first = 'Disrupting p53 raises resistance to some agents in selected models [1, 2], and a CRISPR screen in AML cell lines found TP53 loss among its hits [1].';
        const second = 'A CRISPR screen in AML cell lines found TP53 loss among its hits [1], and disrupting p53 raises resistance in selected models [1, 2].';
        const onParagraph = jest.fn()
            .mockResolvedValueOnce({ action: 'rewrite', paragraph: first })
            .mockResolvedValueOnce({ action: 'rewrite', paragraph: second });
        const onAccept = jest.fn(() => Promise.resolve());
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={onAccept} />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Rewrite' })[0]);
        expect(onParagraph).not.toHaveBeenCalled();
        send(box(/How should it change\?/), 'more concise');
        expect(onParagraph).toHaveBeenLastCalledWith('rewrite', FIRST, 'more concise', []);
        expect(await screen.findByText('Suggested rewrite')).toBeInTheDocument();
        const panel = screen.getByRole('region', { name: 'Rewrite' });
        expect(panel).toHaveTextContent('“more concise”');
        expect(panel).toHaveTextContent('Disrupting p53 raises resistance');

        // Not quite: a revision sends the earlier direction and the suggestion it produced.
        expect(screen.getByRole('button', { name: 'Revise' })).toBeDisabled();
        send(box(/Not quite\?/), 'lead with the screen');
        expect(onParagraph).toHaveBeenLastCalledWith('rewrite', FIRST, 'lead with the screen',
            [{ question: 'more concise', answer: first }]);
        expect(await screen.findByText('Suggested rewrite · revision 2')).toBeInTheDocument();
        expect(panel).toHaveTextContent('“more concise” → “lead with the screen”');
        expect(onAccept).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Replace paragraph' }));
        expect(onAccept).toHaveBeenCalledWith(FIRST, { action: 'rewrite', paragraph: second });
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Rewrite' })).toBeNull());
    });

    it('runs an edit with no direction when the box is left empty', async () => {
        const onParagraph = jest.fn(() => Promise.resolve({ action: 'evidence', paragraph: FIRST, new_references: [], message: 'None of the papers in reach clearly supports this paragraph.' }));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Add evidence' })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Find evidence' }));
        expect(onParagraph).toHaveBeenCalledWith('evidence', FIRST, '', []);
        expect(await screen.findByText('None of the papers in reach clearly supports this paragraph.')).toBeInTheDocument();
        expect(box(/Look for something else/)).toBeInTheDocument();
    });

    it('answers a question about a paragraph in place, and follow-ups see the earlier answers', async () => {
        const onParagraph = jest.fn()
            .mockResolvedValueOnce({ action: 'ask', answer: 'Only in selected models [1].' })
            .mockResolvedValueOnce({ action: 'ask', answer: 'Cisplatin [2].' });
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Ask' })[1]);
        expect(screen.getByRole('button', { name: 'Ask', pressed: true })).toBeInTheDocument();
        const ask = box('Ask anything about this paragraph…');
        send(ask, 'Is it uniform?');
        expect(onParagraph).toHaveBeenCalledWith('ask', expect.stringContaining('sensitization instead [3–4]'), 'Is it uniform?', []);
        const panel = screen.getByRole('region', { name: 'Ask' });
        await waitFor(() => expect(panel).toHaveTextContent('Only in selected models'));
        expect(panel).toHaveTextContent('Is it uniform?');

        send(box('Ask a follow-up…'), 'Which drug?');
        expect(onParagraph).toHaveBeenLastCalledWith('ask', expect.any(String), 'Which drug?',
            [{ question: 'Is it uniform?', answer: 'Only in selected models [1].' }]);
        await waitFor(() => expect(panel).toHaveTextContent('Cisplatin'));
        expect(panel).toHaveTextContent('Only in selected models');
    });

    it('does not send while an input method is composing', () => {
        const onParagraph = jest.fn(() => new Promise(() => {}));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Shorten' })[0]);
        const el = box(/What should stay/);
        fireEvent.change(el, { target: { value: '保留 AML' } });
        fireEvent.keyDown(el, { key: 'Enter', isComposing: true });
        expect(onParagraph).not.toHaveBeenCalled();
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(onParagraph).toHaveBeenCalledWith('shorten', FIRST, '保留 AML', []);
    });

    it("says why an action failed, in the service's words, and keeps what was typed", async () => {
        const onParagraph = jest.fn(() => Promise.reject({ response: { data: { detail: 'Could not rewrite this paragraph.' } } }));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Shorten' })[0]);
        send(box(/What should stay/), 'about 20 words');
        expect(await screen.findByText('Could not rewrite this paragraph.')).toBeInTheDocument();
        expect(box(/What should stay/)).toHaveValue('about 20 words');
    });
});

describe('editing a saved review', () => {
    const { markdownBlocks, isProseBlock, replaceParagraph, renumberReview, linkCitations: link } =
        jest.requireActual('./reviewModel');
    const MD = [
        '# Title', '', 'Abstract cites [2].', '',
        '## One', '', 'First paragraph cites [2, 3].', '', '- a list item [1]', '', 'Second cites [1].',
        '', '## References', '', '1. A (2001). PMID 11.', '2. B (2002). PMID 22.', '3. C (2003). PMID 33.',
        '', '<!-- words 9 / target 6000; cited papers 3; fabricated citations 0 -->', '',
    ].join('\n');
    const REFS = [
        { number: 1, pmid: '11', title: 'A', year: 2001 },
        { number: 2, pmid: '22', title: 'B', year: 2002 },
        { number: 3, pmid: '33', title: 'C', year: 2003 },
    ];

    it('finds a block by its offset in the linked text, citations as stored', () => {
        const body = 'First paragraph cites [2, 3].\n\n- a list item [1]\n\nSecond cites [1].';
        const blocks = markdownBlocks(body);
        expect(blocks.map((b) => b.text)).toEqual(['First paragraph cites [2, 3].', '- a list item [1]', 'Second cites [1].']);
        const linked = link(body);
        blocks.forEach((b) => expect(linked.slice(b.tStart, b.tEnd)).toBe(link(b.text)));
        expect(blocks.map((b) => isProseBlock(b.text))).toEqual([true, false, true]);
        expect(isProseBlock('### Box 1 | Key terms')).toBe(false);
    });

    it('replaces a paragraph, or says it is gone', () => {
        expect(replaceParagraph(MD, 'Second cites [1].', 'Second, rewritten [1].')).toContain('Second, rewritten [1].');
        expect(replaceParagraph(MD, 'Not in it.', 'x')).toBeNull();
    });

    it('numbers again by first appearance, drops what is no longer cited and adds what is new', () => {
        const edited = replaceParagraph(MD, 'Second cites [1].', 'Second cites [4] instead.');
        const { markdown, references } = renumberReview(edited, [...REFS, { number: 4, pmid: '44', title: 'D', year: 2024 }]);
        expect(markdown).toContain('Abstract cites [1].');
        expect(markdown).toContain('First paragraph cites [1, 2].');
        expect(markdown).toContain('- a list item [3]');
        expect(markdown).toContain('Second cites [4] instead.');
        expect(references.map((r) => [r.number, r.pmid])).toEqual([[1, '22'], [2, '33'], [3, '11'], [4, '44']]);
        expect(markdown).toContain('## References\n\n1. B (2002). PMID 22.\n2. C (2003). PMID 33.\n3. A (2001). PMID 11.\n4. D (2024). PMID 44.\n');
        expect(markdown).toMatch(/<!-- words \d+ \/ target 6000; cited papers 4; fabricated citations 0 -->/);

        // A paper no longer cited anywhere leaves the list.
        const dropped = renumberReview(replaceParagraph(edited, '- a list item [1]', '- a list item'), references.length ? [...REFS, { number: 4, pmid: '44', title: 'D', year: 2024 }] : []);
        expect(dropped.references.map((r) => r.pmid)).toEqual(['22', '33', '44']);
        expect(dropped.markdown).not.toContain('PMID 11');
    });
});
