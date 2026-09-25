/**
 * A stored model the catalogue no longer offers is cleared when the catalogue arrives.
 *
 * The 5.6 line was retired on 2026-09-25. A reader who had picked one of its models kept the id
 * in localStorage; the picker swapped it for the default on screen, but the stored value came
 * back on every load and went out on any request sent before the catalogue arrived — a 400
 * from the agent naming a model the reader never saw offered.
 */
jest.mock('../utils/axiosConfig', () => ({ get: jest.fn() }));

/* eslint-disable import/first */
import axios from '../utils/axiosConfig';
/* eslint-enable import/first */

const CATALOGUE = {
    models: [
        { id: 'gpt-6-sol', label: 'GPT-6 Sol', short_label: '6 Sol', pipelines: ['chat', 'deep_research'] },
        { id: 'gpt-6-luna', label: 'GPT-6 Luna', short_label: '6 Luna', pipelines: ['chat'] },
    ],
    default_model: 'gpt-6-sol',
};

// The module caches the catalogue for the page's lifetime, so each test gets a fresh copy.
const load = () => {
    let mod;
    jest.isolateModules(() => { mod = require('./models'); });
    return mod;
};

beforeEach(() => {
    localStorage.clear();
    axios.get.mockReset();
});

it('clears a stored model the catalogue no longer offers', async () => {
    localStorage.setItem('glkb_chat_model', 'gpt-5.6-terra');
    axios.get.mockResolvedValue({ data: CATALOGUE });
    const models = load();
    const seen = [];
    const unsubscribe = models.subscribeToModelPref((value) => seen.push(value));

    await models.fetchModelCatalog();

    expect(models.getModelPref()).toBe('');
    expect(localStorage.getItem('glkb_chat_model')).toBeNull();
    // The composers hear about it, so their state drops the retired id too.
    expect(seen).toContain('');
    unsubscribe();
});

it('keeps a stored model the catalogue still offers', async () => {
    localStorage.setItem('glkb_chat_model', 'gpt-6-luna');
    axios.get.mockResolvedValue({ data: CATALOGUE });
    const models = load();
    await models.fetchModelCatalog();
    expect(models.getModelPref()).toBe('gpt-6-luna');
});

it('keeps the stored model when the catalogue cannot be reached', async () => {
    // The fallback list is a stand-in, not the catalogue — it says nothing about what is retired.
    localStorage.setItem('glkb_chat_model', 'gpt-6-luna');
    axios.get.mockRejectedValue(new Error('offline'));
    const models = load();
    const catalog = await models.fetchModelCatalog();
    expect(catalog.models).toEqual(models.FALLBACK_MODELS);
    expect(models.getModelPref()).toBe('gpt-6-luna');
});

it('falls back to GPT-6 Sol, never a retired model', () => {
    const { FALLBACK_MODELS } = load();
    expect(FALLBACK_MODELS.map((m) => m.id)).toEqual(['gpt-6-sol']);
});
