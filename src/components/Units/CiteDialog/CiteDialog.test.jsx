import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { message } from 'antd';
import CiteDialog from './index';
import { FORMATS, normalizeCitation, generateCitation, generateBibTeX, generateEndNote } from './format';

jest.mock('antd', () => ({ message: { success: jest.fn(), error: jest.fn() } }));
const citation = ['A paper.', 'https://pubmed.ncbi.nlm.nih.gov/12345/?foo=bar', 7, '2024-01-02', 'Journal', ['Ada Lovelace', 'Grace Hopper']];
const paper = normalizeCitation(citation);
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});
it('normalizes the year and PMID without leaking URL query strings', () => {
    expect(paper.year).toBe('2024');
    expect(paper.pubmedId).toBe('12345');
    expect(normalizeCitation(['Title', 'https://example.org/paper']).pubmedId).toBe('');
});
it.each(FORMATS)('%s avoids duplicated punctuation and missing-field placeholders', (format) => {
    expect(generateCitation(format, paper)).not.toContain('..');
    expect(generateCitation(format, paper)).toContain('PubMed ID: 12345.');
    expect(generateCitation(format, normalizeCitation(null))).toBe('');
});
it('exports each author separately in BibTeX and EndNote', () => {
    expect(generateBibTeX(paper)).toContain('author = {Ada Lovelace and Grace Hopper}');
    expect(generateEndNote(paper)).toContain('%A Ada Lovelace\n%A Grace Hopper');
});
it('renders all formats, copies their full text and closes', async () => {
    const onClose = jest.fn();
    render(<CiteDialog open onClose={onClose} citation={citation} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Cite this paper');
    for (const format of FORMATS) {
        fireEvent.click(screen.getByRole('button', { name: `Copy ${format} citation` }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(generateCitation(format, paper)));
    }
    fireEvent.click(screen.getByRole('button', { name: 'BibTeX' }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(generateBibTeX(paper));
    fireEvent.click(screen.getByRole('button', { name: 'EndNote' }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(generateEndNote(paper));
    fireEvent.click(screen.getByRole('button', { name: 'Close citation dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
});
it('reports a clipboard failure instead of claiming success', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
    render(<CiteDialog open citation={citation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy MLA citation' }));
    await waitFor(() => expect(message.error).toHaveBeenCalledWith('Copy failed'));
    expect(message.success).not.toHaveBeenCalled();
});
