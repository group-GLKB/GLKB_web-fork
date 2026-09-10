/**
 * The Quick chip on the home search bar.
 *
 * Quick is chat's level: with it on, the handover to /chat carries `effort: 'quick'` and the
 * model the picker is showing — which defaults to the level's own (Luna) but stays the reader's
 * to change. It is hidden while Investigate is on, because deep research refuses it, and it is
 * not offered at all when the agent's catalogue lists no levels.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';

const mockNavigate = jest.fn();
let mockEfforts = [
    { id: 'quick', label: 'Quick', short_label: 'Quick', description: 'Seconds.', pipelines: ['chat'], default_model: 'gpt-5.6-luna', max_tool_rounds: 2 },
    { id: 'standard', label: 'Standard', short_label: 'Standard', description: 'Half a minute.', pipelines: ['chat', 'deep_research'], default_model: null, max_tool_rounds: null },
];
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../config/features', () => ({ INVESTIGATE_ENABLED: true }));
jest.mock('../../service/models', () => ({
    ...jest.requireActual('../../service/models'),
    fetchModelCatalog: () => Promise.resolve({
        models: [
            { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced.', pipelines: ['chat', 'deep_research'] },
            { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Fastest.', pipelines: ['chat'] },
        ],
        defaultModel: 'gpt-5.6-terra',
        defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
        efforts: mockEfforts,
        defaultEffort: 'standard',
    }),
    getModelPref: () => 'gpt-5.6-terra',
    setModelPref: jest.fn(),
}));

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    mockNavigate.mockClear();
    window.localStorage.clear();
});

const setup = () => render(<LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} />);
const quickChip = () => screen.queryByRole('button', { name: /^quick$/i, hidden: true });
const investigateChip = () => screen.getByRole('button', { name: /investigate/i, hidden: true });
const submit = () => {
    fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
    return mockNavigate.mock.calls[0][1].state.initialSearchOptions;
};

it('sends the level and no model once Quick is on', async () => {
    setup();
    await waitFor(() => expect(quickChip()).toBeInTheDocument());
    fireEvent.click(quickChip());
    expect(quickChip()).toHaveAttribute('aria-pressed', 'true');

    const options = submit();
    expect(options.effort).toBe('quick');
    // The reader had Terra stored, so that is what goes — a level defaults, it does not pin.
    expect(options.model).toBe('gpt-5.6-terra');
    expect(options.investigateEnabled).toBe(false);
    // Remembered for the chat composer, which reads the same preference.
    expect(window.localStorage.getItem('glkb_chat_effort')).toBe('quick');
});

it('sends neither the level nor a locked model while Quick is off', async () => {
    setup();
    await waitFor(() => expect(quickChip()).toBeInTheDocument());
    const options = submit();
    expect(options.effort).toBeUndefined();
    expect(options.model).toBe('gpt-5.6-terra');
});

it('leaves the model picker operable while Quick is on', async () => {
    setup();
    await waitFor(() => expect(quickChip()).toBeInTheDocument());
    fireEvent.click(quickChip());
    const picker = screen.getByRole('button', { name: /^Model:/, hidden: true });
    // This reader has Terra stored, so the level's default does not displace it.
    await waitFor(() => expect(picker).toHaveAccessibleName('Model: GPT-5.6 Terra'));
    expect(picker).not.toBeDisabled();
});

it('withdraws the chip while Investigate is on, and sends no level', async () => {
    setup();
    await waitFor(() => expect(quickChip()).toBeInTheDocument());
    fireEvent.click(quickChip());
    fireEvent.click(investigateChip());
    expect(quickChip()).not.toBeInTheDocument();
    const options = submit();
    expect(options.investigateEnabled).toBe(true);
    expect(options.effort).toBeUndefined();
});

it('is not offered when the agent lists no levels', async () => {
    mockEfforts = [];
    setup();
    // The catalogue resolves in a microtask; give it a tick, then assert the chip never came.
    await waitFor(() => expect(screen.getByRole('button', { name: /investigate/i, hidden: true })).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(quickChip()).not.toBeInTheDocument();
});
