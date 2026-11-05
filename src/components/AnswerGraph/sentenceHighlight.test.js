/**
 * "Show in answer": an answer-graph edge's sentence is found in the RENDERED answer, where its
 * citations are numbered chips rather than the markers the agent wrote (sentenceHighlight.js).
 */
import { findSentenceRange, sentenceKey, showSentence } from './sentenceHighlight';

const answerDom = () => {
    const root = document.createElement('div');
    root.className = 'markdown-body';
    // As ReactMarkdown and the chat's citation chips draw it.
    root.innerHTML = '<p>Metformin <strong>activates</strong> AMPK in hepatocytes '
        + '<a href="https://pubmed.ncbi.nlm.nih.gov/12345678/"><span class="inline-citation-number">1</span></a>. '
        + 'AMPK inhibits mTORC1 signalling, which may slow tumour growth '
        + '<a href="https://pubmed.ncbi.nlm.nih.gov/23456789/"><span class="inline-citation-number">2</span></a>.</p>'
        + '<figure class="ag-card">Metformin activates AMPK in hepatocytes</figure>'
        + '<ul><li>Whether metformin lowers cancer risk in people with type 2 diabetes is debated.</li></ul>';
    document.body.appendChild(root);
    return root;
};

afterEach(() => { document.body.innerHTML = ''; jest.useRealTimers(); });

it('reduces a sentence to what a reader sees of it', () => {
    expect(sentenceKey('Metformin activates AMPK [12345678].')).toBe('metforminactivatesampk');
    expect(sentenceKey('TNF-α rises [[c1, c2]] (PMID: 999) in [mice](https://x.org) [1, 2].')).toBe('tnfαrisesinmice');
});

it('finds a sentence across the answer\'s markup, skipping the citation chips', () => {
    const root = answerDom();
    const range = findSentenceRange(root, 'Metformin activates AMPK in hepatocytes [12345678].');
    expect(range).not.toBeNull();
    expect(range.toString()).toBe('Metformin activates AMPK in hepatocytes');
    const second = findSentenceRange(root, 'AMPK inhibits mTORC1 signalling, which may slow tumour growth [23456789, 34567890].');
    expect(second.toString()).toBe('AMPK inhibits mTORC1 signalling, which may slow tumour growth');
});

it('never matches the graph card itself, and gives up on a sentence that is not there', () => {
    const root = answerDom();
    const range = findSentenceRange(root, 'Metformin activates AMPK in hepatocytes');
    expect(range.startContainer.parentElement.closest('figure')).toBeNull();
    expect(findSentenceRange(root, 'Aspirin cures everything [1].')).toBeNull();
    expect(findSentenceRange(root, '')).toBeNull();
});

it('marks the sentence for a moment, without touching the answer\'s text', () => {
    jest.useFakeTimers();
    const root = answerDom();
    const before = root.innerHTML;
    expect(showSentence(root, 'Whether metformin lowers cancer risk in people with type 2 diabetes is debated [45678901].')).toBe(true);
    // jsdom has no CSS Custom Highlight API: the sentence's block is flashed instead.
    const li = root.querySelector('li');
    expect(li.classList.contains('ag-sentence-flash')).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(li.classList.contains('ag-sentence-flash')).toBe(false);
    expect(root.innerHTML).toBe(before);
    expect(showSentence(root, 'Not in this answer at all.')).toBe(false);
});
