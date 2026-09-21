export const FORMATS = ['MLA', 'APA', 'Chicago', 'Harvard', 'Vancouver'];
export const normalizeCitation = (citation) => {
    const data = citation || [];
    const authors = Array.isArray(data[5]) ? data[5] : String(data[5] || '').split(/,\s*/);
    const url = String(data[1] || '');
    return {
        title: String(data[0] || '').trim(), url,
        year: String(data[3] || '').match(/\b\d{4}\b/)?.[0] || '',
        journal: String(data[4] || '').trim(),
        authors: authors.map((name) => String(name).trim()).filter(Boolean),
        pubmedId: url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)?.[1] || '',
    };
};
const sentence = (value) => value ? /[.!?]$/.test(value) ? value : `${value}.` : '';
export const generateCitation = (format, paper) => {
    const { title, year, journal, pubmedId } = paper;
    const authors = paper.authors.join(', ');
    const id = pubmedId ? `PubMed ID: ${pubmedId}.` : '';
    const datedAuthors = `${authors}${year ? ` (${year})` : ''}`.trim();
    let parts;
    switch (format) {
        case 'MLA': parts = [sentence(authors), title && `"${sentence(title)}"`, sentence([journal, year].filter(Boolean).join(' '))]; break;
        case 'Chicago': parts = [sentence(authors), title && `"${sentence(title)}"`, sentence(`${journal}${year ? ` (${year})` : ''}`.trim())]; break;
        case 'APA': case 'Harvard': parts = [sentence(datedAuthors), sentence(title), sentence(journal)]; break;
        case 'Vancouver': parts = [sentence(authors), sentence(title), sentence(journal), sentence(year)]; break;
        default: return '';
    }
    return [...parts, id].filter(Boolean).join(' ');
};
const escapeBibTeX = (value) => value.replace(/[\\{}%&#_$]/g, (char) =>
    char === '\\' ? '\\textbackslash{}' : `\\${char}`);
export const generateBibTeX = ({ authors, title, journal, year, pubmedId }) =>
    `@article{${pubmedId || 'reference'},\n${[
        ['author', authors.join(' and ')], ['title', title], ['journal', journal], ['year', year],
        ['note', pubmedId ? `PubMed ID: ${pubmedId}` : ''],
    ].filter(([, value]) => value).map(([key, value]) => `  ${key} = {${escapeBibTeX(value)}}`).join(',\n')}\n}`;
export const generateEndNote = ({ authors, title, journal, year, pubmedId, url }) =>
    ['%0 Journal Article', ...authors.map((name) => `%A ${name}`),
        ...[['T', title], ['J', journal], ['D', year], ['M', pubmedId], ['U', url]]
            .filter(([, value]) => value).map(([tag, value]) => `%${tag} ${value}`)].join('\n');
