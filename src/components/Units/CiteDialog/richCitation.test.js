import { formatCitation, formatCitationHtml, FORMATS } from './format';
import { copyCitation } from './clipboard';

const record = { title: 'Cell 141 <study>', author: [{ family: 'A&B', given: 'C' }],
    'container-title': 'Cell', 'container-title-short': 'Cell', volume: '141', issue: '2',
    page: '1-4', issued: { 'date-parts': [[2024]] } };
const parse = html => { const el = document.createElement('div'); el.innerHTML = html; return el; };
const readBlob = blob => new Promise(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob);
});

it.each([...FORMATS, 'AMA', 'Nature'])('%s rich and plain forms have identical text', format => {
    [record, { ...record, volume: '', 'container-title': '' },
        { ...record, 'container-title': 'J.', 'container-title-short': 'J.' }].forEach(item => {
        expect(parse(formatCitationHtml(format, item)).textContent).toBe(formatCitation(format, item));
    });
});
it('italicizes the APA journal and volume but not issue, title or matching title words', () => {
    const el = parse(formatCitationHtml('APA', record));
    expect([...el.querySelectorAll('em')].map(n => n.textContent)).toEqual(['Cell', '141']);
    expect(el.innerHTML).toContain('</em>(2)');
    expect(el.innerHTML).toContain('Cell 141 &lt;study&gt;');
    expect(el.querySelector('strong')).toBeNull();
});
it.each(['MLA', 'Chicago', 'Harvard'])('%s italicizes only the journal', format => {
    const el = parse(formatCitationHtml(format, record));
    expect([...el.querySelectorAll('em')].map(n => n.textContent)).toEqual(['Cell']);
    expect(el.querySelector('strong')).toBeNull();
});
it('keeps NLM Vancouver roman and supports Nature bold volume', () => {
    expect(parse(formatCitationHtml('Vancouver', record)).querySelector('em,strong')).toBeNull();
    expect(parse(formatCitationHtml('Nature', record)).querySelector('strong').textContent).toBe('141');
});
it('escapes untrusted metadata', () => {
    const el = parse(formatCitationHtml('APA', { ...record, 'container-title': '<img src=x onerror=alert(1)>' }));
    expect(el.querySelector('img,script,study')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
});

describe('clipboard', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true,
            value: { write: jest.fn().mockResolvedValue(), writeText: jest.fn().mockResolvedValue() } });
        global.ClipboardItem = class { constructor(data) { this.data = data; } };
    });
    afterEach(() => { delete global.ClipboardItem; });
    it('copies HTML and plain text in one clipboard item', async () => {
        const html = formatCitationHtml('APA', record);
        const text = formatCitation('APA', record);
        expect(await copyCitation(text, html)).toBe(true);
        const item = navigator.clipboard.write.mock.calls[0][0][0];
        expect(await readBlob(item.data['text/html'])).toBe(html);
        expect(await readBlob(item.data['text/plain'])).toBe(text);
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
    it('falls back when HTML clipboard is unsupported or denied', async () => {
        navigator.clipboard.write.mockRejectedValue(new Error('denied'));
        expect(await copyCitation('citation', '<em>citation</em>')).toBe(false);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('citation');
        delete global.ClipboardItem;
        expect(await copyCitation('citation', '<em>citation</em>')).toBe(false);
    });
    it('keeps machine-readable exports plain and reports copy failures', async () => {
        await copyCitation('@article{}');
        expect(navigator.clipboard.write).not.toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('@article{}');
        navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
        await expect(copyCitation('citation')).rejects.toThrow('denied');
    });
});
