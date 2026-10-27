import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
    countWords, expandCitation, linkCitations, locateSelection, minutesLeft, parseReview, proseWords, reviewAudit,
    stageFill,
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
    /* Selects the page's text from `from` to `to` (each found in a paragraph's text nodes, so a selection
       may run over a citation pill), as the reader would with the mouse, and waits for the toolbar. */
    const textAt = (text, end = false) => {
        const walker = document.createTreeWalker(document.querySelector('.lr-document'), NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const i = node.data.indexOf(text);
            if (i >= 0 && node.parentElement.closest('.lr-para > p') && !node.parentElement.closest('.lr-cite')) {
                return [node, end ? i + text.length : i];
            }
            node = walker.nextNode();
        }
        throw new Error(`no text "${text}"`);
    };
    const select = async (from, to = from) => {
        const range = document.createRange();
        range.setStart(...textAt(from));
        range.setEnd(...textAt(to, true));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        fireEvent.mouseDown(document.querySelector('.lr-document'));
        fireEvent.mouseUp(document);
        return screen.findByRole('toolbar', { name: 'Selection actions' });
    };
    const tool = (toolbar, name) => within(toolbar).getByRole('button', { name });

    it('offers the four actions over a selection in a paragraph, and none without one', async () => {
        render(<ReviewDocument markdown={REVIEW} onParagraph={jest.fn()} onAccept={jest.fn()} />);
        expect(screen.queryByRole('toolbar', { name: 'Selection actions' })).toBeNull();
        expect(screen.getByText(/Select text to ask about it/)).toBeInTheDocument();
        const toolbar = await select('a CRISPR screen');
        expect(within(toolbar).getAllByRole('button').map((b) => b.textContent))
            .toEqual(['Ask', 'Rewrite', 'Shorten', 'Add evidence']);
        // Escape puts it away.
        fireEvent.keyUp(document, { key: 'Escape' });
        expect(screen.queryByRole('toolbar', { name: 'Selection actions' })).toBeNull();
    });

    it('rewrites only the selected text the way the reader says, and replaces it only when accepted', async () => {
        const spliced = FIRST.replace('In AML cell lines a CRISPR screen identified TP53 loss among the hits [1].',
                                      'A CRISPR screen in AML cell lines found TP53 loss [1].');
        const onParagraph = jest.fn()
            .mockResolvedValueOnce({ action: 'rewrite', paragraph: spliced,
                                     selection: 'In AML cell lines a CRISPR screen identified TP53 loss among the hits [1]',
                                     replacement: 'A CRISPR screen in AML cell lines found TP53 loss [1]' });
        const onAccept = jest.fn(() => Promise.resolve());
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={onAccept} />);

        // From "In AML" over the end of "hits" -- the citation after it goes with the clause it ends.
        fireEvent.click(tool(await select('In AML', 'among the hits'), 'Rewrite'));
        expect(onParagraph).not.toHaveBeenCalled();
        const panel = screen.getByRole('region', { name: 'Rewrite' });
        expect(panel).toHaveTextContent('Selected text only');
        expect(screen.getByRole('button', { name: 'Rewrite', pressed: true })).toBeInTheDocument();
        send(box(/How should it change\?/), 'plainer');
        const selection = 'In AML cell lines a CRISPR screen identified TP53 loss among the hits [1]';
        expect(onParagraph).toHaveBeenLastCalledWith('rewrite', FIRST, 'plainer', [],
                                                     { text: selection, start: FIRST.indexOf(selection) });
        expect(await screen.findByText(/^Proposed · 3 fewer words$/)).toBeInTheDocument();
        expect(panel).toHaveTextContent('A CRISPR screen in AML cell lines found TP53 loss');
        expect(onAccept).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Replace selection' }));
        expect(onAccept).toHaveBeenCalledWith(FIRST, expect.objectContaining({ paragraph: spliced }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Rewrite' })).toBeNull());
        expect(screen.getByText(/^Edited/)).toBeInTheDocument();
    });

    it('a revision after "Try again" sends the earlier direction and the suggestion it produced', async () => {
        const first = 'Disrupting p53 raises resistance to some agents in selected models [1, 2], and a CRISPR screen in AML cell lines found TP53 loss among its hits [1].';
        const onParagraph = jest.fn()
            .mockResolvedValueOnce({ action: 'rewrite', paragraph: first })
            .mockResolvedValueOnce({ action: 'rewrite', paragraph: first.replace('Disrupting', 'Removing') });
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        // All of the paragraph selected: the action works on the paragraph, as before.
        fireEvent.click(tool(await select('Deliberate p53', 'among the hits'), 'Rewrite'));
        expect(screen.getByRole('region', { name: 'Rewrite' })).toHaveTextContent('This paragraph only');
        send(box(/How should it change\?/), 'more concise');
        expect(onParagraph).toHaveBeenLastCalledWith('rewrite', FIRST, 'more concise', [], null);
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        send(box(/How should it change\?/), 'lead with the screen');
        expect(onParagraph).toHaveBeenLastCalledWith('rewrite', FIRST, 'lead with the screen',
            [{ question: 'more concise', answer: first }], null);
        expect(await screen.findByRole('button', { name: 'Replace paragraph' })).toBeInTheDocument();
    });

    it('Shorten and Add evidence run at once on the selection, with no direction', async () => {
        const onParagraph = jest.fn(() => Promise.resolve({ action: 'evidence', paragraph: FIRST, new_references: [], message: 'None of the papers in reach clearly supports this paragraph.' }));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(tool(await select('CRISPR screen'), 'Add evidence'));
        expect(onParagraph).toHaveBeenCalledWith('evidence', FIRST, '', [], { text: 'CRISPR screen', start: FIRST.indexOf('CRISPR screen') });
        expect(await screen.findByText('None of the papers in reach clearly supports this paragraph.')).toBeInTheDocument();
        // Try again opens the box for a direction, with the evidence action's own words.
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(box(/What evidence\?/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Find evidence' })).toBeInTheDocument();
    });

    it('answers a question about the selected text in place, and a follow-up sees the earlier answer', async () => {
        const onParagraph = jest.fn()
            .mockResolvedValueOnce({ action: 'ask', answer: 'Only in selected models [3].' })
            .mockResolvedValueOnce({ action: 'ask', answer: 'Cisplatin [4].' });
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        // A selection over a citation pill: the pill's own text is not the paragraph's.
        fireEvent.click(tool(await select('Other settings', 'so the effect'), 'Ask'));
        const para = 'Other settings show sensitization instead [3–4], so the effect is not uniform across models and drugs.';
        send(box('Ask about the selected text…'), 'Is it uniform?');
        expect(onParagraph).toHaveBeenCalledWith('ask', para, 'Is it uniform?', [],
                                                 { text: 'Other settings show sensitization instead [3–4], so the effect', start: 0 });
        const panel = screen.getByRole('region', { name: 'Ask' });
        await waitFor(() => expect(panel).toHaveTextContent('Only in selected models'));
        expect(panel).toHaveTextContent('“Is it uniform?”');

        fireEvent.click(screen.getByRole('button', { name: 'Ask a follow-up' }));
        send(box('Ask about the selected text…'), 'Which drug?');
        expect(onParagraph).toHaveBeenLastCalledWith('ask', para, 'Which drug?',
            [{ question: 'Is it uniform?', answer: 'Only in selected models [3].' }], expect.any(Object));
        await waitFor(() => expect(panel).toHaveTextContent('Cisplatin'));
    });

    it('an Ask with nothing typed asks the first suggestion; a suggestion runs as its action', async () => {
        const onParagraph = jest.fn(() => new Promise(() => {}));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(tool(await select('CRISPR screen'), 'Ask'));
        send(box('Ask about the selected text…'));
        expect(onParagraph).toHaveBeenLastCalledWith('ask', FIRST, 'What is the strongest evidence here?', [], expect.any(Object));
        expect(screen.getByRole('status')).toHaveTextContent('Reading the cited sources…');
    });

    it('a rewrite suggestion "More concise" shortens', async () => {
        const onParagraph = jest.fn(() => new Promise(() => {}));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(tool(await select('CRISPR screen'), 'Rewrite'));
        fireEvent.click(screen.getByRole('button', { name: 'More concise' }));
        expect(onParagraph).toHaveBeenLastCalledWith('shorten', FIRST, '', [], expect.any(Object));
    });

    it("says why an action failed, in the service's words, and keeps what was typed", async () => {
        const onParagraph = jest.fn(() => Promise.reject({ response: { data: { detail: 'Could not rewrite this paragraph.' } } }));
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={jest.fn()} />);
        fireEvent.click(tool(await select('CRISPR screen'), 'Rewrite'));
        send(box(/How should it change\?/), 'about 20 words');
        expect(await screen.findByText('Could not rewrite this paragraph.')).toBeInTheDocument();
        expect(box(/How should it change\?/)).toHaveValue('about 20 words');
    });

    it('puts the last accepted edit back with Undo', async () => {
        const onParagraph = jest.fn(() => Promise.resolve({ action: 'shorten', paragraph: 'Shorter [1].', selection: 'x', replacement: 'Shorter [1]' }));
        const onUndo = jest.fn(() => Promise.resolve());
        render(<ReviewDocument markdown={REVIEW} onParagraph={onParagraph} onAccept={() => Promise.resolve()} onUndo={onUndo} />);
        fireEvent.click(tool(await select('CRISPR screen'), 'Shorten'));
        fireEvent.click(await screen.findByRole('button', { name: 'Replace selection' }));
        const undo = await screen.findByRole('button', { name: 'Undo' });
        await act(async () => { fireEvent.click(undo); });
        expect(onUndo).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    });
});

describe('selecting text', () => {
    const SRC = 'Deliberate *p53* disruption increases resistance [1, 2]. In AML a screen found TP53 loss [1].';

    it('finds the selection in the markdown, over citations and emphasis, to whole words', () => {
        // The page shows "p53" without its asterisks, and the pill instead of [1, 2].
        expect(locateSelection(SRC, 'Deliberate ', 'p53 disruption increases resistance ')).toEqual(
            { text: '*p53* disruption increases resistance [1, 2]', start: 11, whole: false },
        );
        // Half a word is widened to the word.
        expect(locateSelection(SRC, 'Deliberate p53 disruption increases resistance . In AML a scr', 'een fou'))
            .toEqual({ text: 'screen found', start: SRC.indexOf('screen found'), whole: false });
        // All of it is the paragraph.
        expect(locateSelection(SRC, '', SRC.replace(/\[[\d, ]+\]/g, '').replace(/\*/g, '')).whole).toBe(true);
    });

    it('takes the repeated phrase the reader selected, not the first one', () => {
        const src = 'The screen [1] was small. A second screen [2] was large.';
        const found = locateSelection(src, 'The screen  was small. A second ', 'screen');
        expect(found.start).toBe(src.lastIndexOf('screen'));
        expect(found.text).toBe('screen [2]');
    });

    it('is null when the selection is not in the paragraph', () => {
        expect(locateSelection(SRC, '', 'not here at all')).toBeNull();
        expect(locateSelection(SRC, '', '   ')).toBeNull();
    });

    it('counts prose words without the citations', () => {
        expect(proseWords('A claim [1, 2] and another [3].')).toBe(4);
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
