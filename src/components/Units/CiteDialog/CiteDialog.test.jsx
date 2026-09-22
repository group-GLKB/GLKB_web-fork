import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { message } from 'antd';
import CiteDialog from './index';
import {
    FORMATS, cslFromCard, formatCitation, toBibTeX, toEndNote, expandPageRange, splitDisplayName, bibtexKey,
} from './format';
import { fetchCitation, fetchRis } from '../../../service/Citation';

jest.mock('antd', () => ({ message: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../service/Citation', () => ({
    fetchCitation: jest.fn(),
    fetchRis: jest.fn(),
    clearCitationCache: jest.fn(),
}));

// PMID 20362325 exactly as NCBI's Literature Citation Exporter returns it (16 authors).
const BUNTING = {
    source: 'PubMed',
    id: 'pmid:20362325',
    title: '53BP1 inhibits homologous recombination in Brca1-deficient cells by blocking resection of DNA breaks',
    author: [
        { family: 'Bunting', given: 'Samuel F' }, { family: 'Callén', given: 'Elsa' }, { family: 'Wong', given: 'Nancy' },
        { family: 'Chen', given: 'Hua-Tang' }, { family: 'Polato', given: 'Federica' }, { family: 'Gunn', given: 'Amanda' },
        { family: 'Bothmer', given: 'Anne' }, { family: 'Feldhahn', given: 'Niklas' }, { family: 'Fernandez-Capetillo', given: 'Oscar' },
        { family: 'Cao', given: 'Liu' }, { family: 'Xu', given: 'Xiaoling' }, { family: 'Deng', given: 'Chu-Xia' },
        { family: 'Finkel', given: 'Toren' }, { family: 'Nussenzweig', given: 'Michel' }, { family: 'Stark', given: 'Jeremy M' },
        { family: 'Nussenzweig', given: 'André' },
    ],
    'container-title-short': 'Cell',
    'container-title': 'Cell',
    'publisher-place': 'United States',
    ISSN: '0092-8674',
    issued: { 'date-parts': [[2010, 4, 16]] },
    'epub-date': { 'date-parts': [[2010, 4, 1]] },
    page: '243-54',
    volume: '141',
    issue: '2',
    PMID: '20362325',
    PMCID: 'PMC2857570',
    DOI: '10.1016/j.cell.2010.03.012',
    type: 'article-journal',
};
const TITLE = '53BP1 inhibits homologous recombination in Brca1-deficient cells by blocking resection of DNA breaks';

const card = ['A paper.', 'https://pubmed.ncbi.nlm.nih.gov/12345/?foo=bar', 7, '2024-01-02', 'Journal', ['Ada Lovelace', 'Grace Hopper']];

beforeEach(() => {
    jest.clearAllMocks();
    fetchCitation.mockResolvedValue(BUNTING);
    fetchRis.mockResolvedValue('TY  - JOUR\nAU  - Bunting, Samuel F\nER  - \n');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});

describe('the five styles, on a real 16-author record', () => {
    it('MLA 9: first author and et al., journal volume/issue/year, minimal-two pages, DOI URL', () => {
        expect(formatCitation('MLA', BUNTING)).toBe(
            `Bunting, Samuel F., et al. "${TITLE}." Cell, vol. 141, no. 2, 2010, pp. 243–54. https://doi.org/10.1016/j.cell.2010.03.012.`,
        );
    });
    it('APA 7: initials with hyphens kept, ampersand before the last author, expanded pages, bare DOI URL', () => {
        expect(formatCitation('APA', BUNTING)).toBe(
            'Bunting, S. F., Callén, E., Wong, N., Chen, H.-T., Polato, F., Gunn, A., Bothmer, A., Feldhahn, N., '
            + 'Fernandez-Capetillo, O., Cao, L., Xu, X., Deng, C.-X., Finkel, T., Nussenzweig, M., Stark, J. M., & Nussenzweig, A. '
            + `(2010). ${TITLE}. Cell, 141(2), 243–254. https://doi.org/10.1016/j.cell.2010.03.012`,
        );
    });
    it('Chicago 17: more than ten authors → the first seven and et al.; "141, no. 2 (2010): 243–54."', () => {
        expect(formatCitation('Chicago', BUNTING)).toBe(
            'Bunting, Samuel F., Elsa Callén, Nancy Wong, Hua-Tang Chen, Federica Polato, Amanda Gunn, Anne Bothmer, et al. '
            + `"${TITLE}." Cell 141, no. 2 (2010): 243–54. https://doi.org/10.1016/j.cell.2010.03.012.`,
        );
    });
    it('Harvard (Cite Them Right): four or more authors → first and et al., year in parentheses, single-quoted title', () => {
        expect(formatCitation('Harvard', BUNTING)).toBe(
            `Bunting, S.F. et al. (2010) '${TITLE}', Cell, 141(2), pp. 243–254. Available at: https://doi.org/10.1016/j.cell.2010.03.012.`,
        );
    });
    it('Vancouver: six authors then et al., NLM date;volume(issue):pages, doi, PMID and PMCID', () => {
        expect(formatCitation('Vancouver', BUNTING)).toBe(
            `Bunting SF, Callén E, Wong N, Chen HT, Polato F, Gunn A, et al. ${TITLE}. Cell. 2010 Apr 16;141(2):243-54. `
            + 'doi: 10.1016/j.cell.2010.03.012. PMID: 20362325; PMCID: PMC2857570.',
        );
    });
    it('no two styles render the same string', () => {
        const rendered = FORMATS.map((format) => formatCitation(format, BUNTING));
        expect(new Set(rendered).size).toBe(FORMATS.length);
    });
});

describe('author-count rules', () => {
    const withAuthors = (n) => ({
        ...BUNTING,
        author: Array.from({ length: n }, (_, i) => ({ family: `Family${i + 1}`, given: `Given${i + 1}` })),
    });
    it('MLA and Chicago join two authors with "and"; APA with ", &"; Harvard with "and"; Vancouver with a comma', () => {
        const two = withAuthors(2);
        expect(formatCitation('MLA', two)).toMatch(/^Family1, Given1, and Given2 Family2\. "/);
        expect(formatCitation('Chicago', two)).toMatch(/^Family1, Given1, and Given2 Family2\. "/);
        expect(formatCitation('APA', two)).toMatch(/^Family1, G\., & Family2, G\. \(2010\)\./);
        expect(formatCitation('Harvard', two)).toMatch(/^Family1, G\. and Family2, G\. \(2010\) '/);
        expect(formatCitation('Vancouver', two)).toMatch(/^Family1 G, Family2 G\. 53BP1/);
    });
    it('Chicago lists all of ten authors with an Oxford comma; Harvard lists three', () => {
        expect(formatCitation('Chicago', withAuthors(10))).toMatch(/Given9 Family9, and Given10 Family10\. "/);
        expect(formatCitation('Harvard', withAuthors(3))).toMatch(/^Family1, G\., Family2, G\. and Family3, G\. \(2010\)/);
    });
    it('APA lists up to twenty authors and elides twenty-one or more to nineteen … last', () => {
        expect(formatCitation('APA', withAuthors(20))).toContain('Family19, G., & Family20, G. (2010).');
        const many = formatCitation('APA', withAuthors(25));
        expect(many).toContain('Family19, G., . . . Family25, G. (2010).');
        expect(many).not.toContain('Family20');
    });
    it('a record without authors starts with the title', () => {
        const none = { ...BUNTING, author: [] };
        expect(formatCitation('APA', none)).toMatch(/^53BP1 inhibits .* \(2010\)\. Cell, 141\(2\), 243–254\./);
        expect(formatCitation('MLA', none)).toMatch(/^"53BP1 inhibits/);
        expect(formatCitation('Harvard', none)).toMatch(/^'53BP1 inhibits .*' \(2010\) Cell, 141\(2\), pp\. 243–254\./);
    });
});

describe('fields that are often missing', () => {
    it('renders without pages, issue or DOI and never leaves doubled punctuation or empty brackets', () => {
        const thin = { ...BUNTING, page: undefined, issue: undefined, DOI: undefined, PMCID: undefined };
        expect(formatCitation('MLA', thin)).toBe(`Bunting, Samuel F., et al. "${TITLE}." Cell, vol. 141, 2010.`);
        expect(formatCitation('APA', thin)).toContain(`(2010). ${TITLE}. Cell, 141.`);
        expect(formatCitation('Vancouver', thin)).toBe(
            `Bunting SF, Callén E, Wong N, Chen HT, Polato F, Gunn A, et al. ${TITLE}. Cell. 2010 Apr 16;141. PMID: 20362325.`,
        );
        FORMATS.forEach((format) => {
            const text = formatCitation(format, thin);
            expect(text).not.toMatch(/\.\./);
            expect(text).not.toMatch(/\(\)|,\s*,|\s,/);
        });
    });
    it('a year-only date renders as the year; a season is kept in Vancouver', () => {
        const yearOnly = { ...BUNTING, issued: { 'date-parts': [[2010]] } };
        expect(formatCitation('Vancouver', yearOnly)).toContain('Cell. 2010;141(2):243-54.');
        const season = { ...BUNTING, issued: { 'date-parts': [[2010]], season: 'Spring' } };
        expect(formatCitation('Vancouver', season)).toContain('Cell. 2010 Spring;141(2):243-54.');
    });
    it('a title that already ends in punctuation is not given a second full stop', () => {
        const question = { ...BUNTING, title: 'Does 53BP1 block resection?' };
        expect(formatCitation('APA', question)).toContain('(2010). Does 53BP1 block resection? Cell,');
        expect(formatCitation('MLA', question)).toContain('"Does 53BP1 block resection?" Cell,');
    });
    it('expands abbreviated page ranges and leaves article numbers alone', () => {
        expect(expandPageRange('243-54')).toEqual(['243', '254']);
        expect(expandPageRange('1100-5')).toEqual(['1100', '1105']);
        expect(expandPageRange('S12-S15')).toEqual(['S12', 'S15']);
        expect(expandPageRange('e1004')).toEqual(['e1004', '']);
        expect(expandPageRange('')).toEqual(['', '']);
    });
});

describe('the fallback record built from a reference card', () => {
    it('keeps the PMID, year, journal and split authors, and is marked partial', () => {
        const item = cslFromCard(card);
        expect(item.PMID).toBe('12345');
        expect(item.issued).toEqual({ 'date-parts': [[2024]] });
        expect(item['container-title']).toBe('Journal');
        expect(item.author).toEqual([{ family: 'Lovelace', given: 'Ada' }, { family: 'Hopper', given: 'Grace' }]);
        expect(item.partial).toBe(true);
        expect(cslFromCard(['Title', 'https://example.org/paper']).PMID).toBeUndefined();
        expect(cslFromCard(null).title).toBe('');
    });
    it('splits display names, keeping particles with the family name', () => {
        expect(splitDisplayName('Ludwig van Beethoven')).toEqual({ family: 'van Beethoven', given: 'Ludwig' });
        expect(splitDisplayName('Hopper, Grace')).toEqual({ family: 'Hopper', given: 'Grace' });
        expect(splitDisplayName('Prince')).toEqual({ family: 'Prince', given: '' });
    });
    it('still renders every style from the card alone', () => {
        const item = cslFromCard(card);
        expect(formatCitation('APA', item)).toBe('Lovelace, A., & Hopper, G. (2024). A paper. Journal.');
        expect(formatCitation('Vancouver', item)).toBe('Lovelace A, Hopper G. A paper. Journal. 2024. PMID: 12345.');
        FORMATS.forEach((format) => expect(formatCitation(format, item)).not.toBe(''));
    });
});

describe('exports', () => {
    it('BibTeX carries every field, one author per "and", expanded pages and the pubmed key', () => {
        const bib = toBibTeX(BUNTING);
        expect(bib.startsWith('@article{pubmed20362325,\n')).toBe(true);
        expect(bib).toContain('author  = {Bunting, Samuel F and Callén, Elsa and Wong, Nancy and');
        expect(bib).toContain('and Nussenzweig, André}');
        expect(bib).toContain(`title   = {${TITLE}}`);
        expect(bib).toContain('journal = {Cell}');
        expect(bib).toContain('year    = {2010}');
        expect(bib).toContain('month   = apr');
        expect(bib).toContain('volume  = {141}');
        expect(bib).toContain('number  = {2}');
        expect(bib).toContain('pages   = {243--254}');
        expect(bib).toContain('doi     = {10.1016/j.cell.2010.03.012}');
        expect(bib).toContain('pmid    = {20362325}');
        expect(bib).toContain('pmcid   = {PMC2857570}');
        expect(bib).toContain('issn    = {0092-8674}');
        expect(bib).toContain('url     = {https://pubmed.ncbi.nlm.nih.gov/20362325/}');
        expect(bib.endsWith('\n}')).toBe(true);
    });
    it('BibTeX escapes TeX specials in text fields but not in identifiers', () => {
        const bib = toBibTeX({ ...BUNTING, title: 'Cost & benefit of 5% H_2O', DOI: '10.1000/a_b&c' });
        expect(bib).toContain('title   = {Cost \\& benefit of 5\\% H\\_2O}');
        expect(bib).toContain('doi     = {10.1000/a_b&c}');
    });
    it('BibTeX key falls back to author and year without a PMID', () => {
        expect(bibtexKey({ ...BUNTING, PMID: undefined, id: undefined })).toBe('Bunting2010');
    });
    it('EndNote tagged format carries authors, volume, issue, pages, DOI and PMID', () => {
        const refer = toEndNote(BUNTING);
        expect(refer.startsWith('%0 Journal Article\n%A Bunting, Samuel F\n%A Callén, Elsa\n')).toBe(true);
        expect(refer).toContain(`\n%T ${TITLE}\n%J Cell\n%V 141\n%N 2\n%P 243-254\n%D 2010\n%8 2010 Apr 16\n%R 10.1016/j.cell.2010.03.012\n%M 20362325\n%@ 0092-8674\n%U https://pubmed.ncbi.nlm.nih.gov/20362325/`);
    });
});

describe('the dialog', () => {
    it('fetches the record for the card\'s PMID, renders the five styles from it and copies them', async () => {
        const onClose = jest.fn();
        render(<CiteDialog open onClose={onClose} citation={['Old title', 'https://pubmed.ncbi.nlm.nih.gov/20362325/', 790, '2010', 'Cell', 'Samuel F Bunting']} />);
        expect(screen.getByRole('dialog')).toHaveAccessibleName('Cite this paper');
        expect(fetchCitation).toHaveBeenCalledWith('20362325');
        await waitFor(() => expect(screen.getByLabelText('APA')).toHaveTextContent('Cell, 141(2), 243–254.'));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        for (const format of FORMATS) {
            fireEvent.click(screen.getByRole('button', { name: `Copy ${format} citation` }));
            // eslint-disable-next-line no-await-in-loop
            await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(formatCitation(format, BUNTING)));
        }
        fireEvent.click(screen.getByRole('button', { name: 'BibTeX' }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(toBibTeX(BUNTING)));
        fireEvent.click(screen.getByRole('button', { name: 'EndNote' }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(toEndNote(BUNTING)));
        fireEvent.click(screen.getByRole('button', { name: 'RIS' }));
        await waitFor(() => expect(fetchRis).toHaveBeenCalledWith('20362325'));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining('TY  - JOUR')));
        fireEvent.click(screen.getByRole('button', { name: 'Close citation dialog' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('falls back to the card and says so when the record cannot be fetched', async () => {
        fetchCitation.mockResolvedValue(null);
        render(<CiteDialog open citation={card} />);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('could not be fetched'));
        expect(screen.getByLabelText('APA')).toHaveTextContent('Lovelace, A., & Hopper, G. (2024). A paper. Journal.');
        fetchRis.mockResolvedValue(null);
        fireEvent.click(screen.getByRole('button', { name: 'RIS' }));
        await waitFor(() => expect(message.error).toHaveBeenCalledWith('No RIS citation available for this paper'));
    });
    it('reports a clipboard failure instead of claiming success', async () => {
        navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
        render(<CiteDialog open citation={card} />);
        await waitFor(() => expect(screen.getByLabelText('MLA')).toHaveTextContent('Bunting'));
        fireEvent.click(screen.getByRole('button', { name: 'Copy MLA citation' }));
        await waitFor(() => expect(message.error).toHaveBeenCalledWith('Copy failed'));
        expect(message.success).not.toHaveBeenCalled();
    });
});
