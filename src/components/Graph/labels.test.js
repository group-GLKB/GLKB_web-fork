import { GRAPH_FONT, graphLabel, loadGraphFont } from './labels';

it.each([
    [{ display: 'Display', name: 'Name' }, 'Display'],
    [{ display: '  ', name: 'Name' }, 'Name'],
    [{ symbol: 'CFTR' }, 'CFTR'],
    [{ id: 42 }, '42'],
    [{}, ''],
])('has a safe label for %j', (data, expected) => {
    expect(graphLabel(data)).toBe(expected);
});

it('uses the loaded site font and waits for it before measuring text', async () => {
    let finish;
    const fonts = { load: jest.fn(() => new Promise(resolve => { finish = resolve; })) };
    let ready = false;
    const pending = loadGraphFont(fonts).then(() => { ready = true; });
    expect(ready).toBe(false);
    expect(fonts.load).toHaveBeenCalledWith('400 12px Geist');
    expect(GRAPH_FONT).toBe('Geist, Arial, sans-serif');
    finish([]);
    await pending;
    expect(ready).toBe(true);
});

it('falls back if fonts cannot load or FontFaceSet is unavailable', async () => {
    await expect(loadGraphFont({ load: () => Promise.reject(new Error('offline')) })).resolves.toBeUndefined();
    await expect(loadGraphFont(null)).resolves.toBeUndefined();
});
