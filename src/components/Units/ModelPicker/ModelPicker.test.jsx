/**
 * The composer's model picker.
 *
 * The properties worth pinning are the two that are easy to get subtly wrong and that
 * nothing on screen would reveal:
 *
 *   * a resolved default is reported but NOT remembered — it reaches the parent so the
 *     request can name a model explicitly, and it must not be written to storage, or the
 *     id that happened to be default today would be pinned for this reader forever;
 *   * the default is reported at most once, however often the parent re-renders. The
 *     parent stores what we report, which re-renders us, which is exactly the shape that
 *     turns a one-shot callback into a loop.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ModelPicker from '.';
import { fetchModelCatalog } from '../../../service/models';

jest.mock('../../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
// Only the network call is faked. `forPipeline` and `modelLabel` are the real ones, so the
// filtering and abbreviation rules under test here are the shipped implementations rather
// than a second copy that can agree with a broken original.
jest.mock('../../../service/models', () => ({
    ...jest.requireActual('../../../service/models'),
    fetchModelCatalog: jest.fn(),
}));

/** MUI's useMediaQuery needs matchMedia; `matches` is what the tests below steer. */
const setViewport = (narrow) => {
    window.matchMedia = (query) => ({
        matches: narrow, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
};

const BOTH = ['chat', 'deep_research'];
const CATALOG = {
    models: [
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', short_label: '5.6 Sol', description: 'Most capable.', pipelines: BOTH },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', short_label: '5.6 Terra', description: 'Balanced.', pipelines: BOTH },
        { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', short_label: '5.6 Luna', description: 'Fastest.', pipelines: ['chat'] },
    ],
    defaultModel: 'gpt-5.6-terra',
    defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
};

beforeEach(() => {
    fetchModelCatalog.mockReset();
    fetchModelCatalog.mockResolvedValue(CATALOG);
    setViewport(false);
});

const setup = (props = {}) => {
    const onChange = jest.fn();
    const onResolveDefault = jest.fn();
    const view = render(
        <ModelPicker onChange={onChange} onResolveDefault={onResolveDefault} {...props} />,
    );
    return { onChange, onResolveDefault, view };
};

it('shows the deployment default when the reader has chosen nothing', async () => {
    const { onResolveDefault } = setup({ value: '' });
    expect(await screen.findByText('GPT-5.6 Terra')).toBeInTheDocument();
    // Reported up, so the request can carry the id explicitly rather than relying on two
    // services independently agreeing on what "unspecified" means. `waitFor` because the
    // report happens in an effect, i.e. one render after the chip already reads correctly.
    await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('gpt-5.6-terra'));
});

it('shows the stored choice instead of the default', async () => {
    const { onResolveDefault } = setup({ value: 'gpt-5.6-luna' });
    expect(await screen.findByText('GPT-5.6 Luna')).toBeInTheDocument();
    expect(onResolveDefault).not.toHaveBeenCalled();
});

it('reports the default once, however often the parent re-renders', async () => {
    const { onResolveDefault, view } = setup({ value: '' });
    await screen.findByText('GPT-5.6 Terra');
    view.rerender(
        <ModelPicker value="gpt-5.6-terra" onChange={() => {}} onResolveDefault={onResolveDefault} />,
    );
    view.rerender(
        <ModelPicker value="gpt-5.6-terra" onChange={() => {}} onResolveDefault={onResolveDefault} />,
    );
    expect(onResolveDefault).toHaveBeenCalledTimes(1);
});

it('lists every model with its description, and marks the default', async () => {
    setup({ value: '' });
    fireEvent.click(await screen.findByRole('button'));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
        'GPT-5.6 SolMost capable.',
        'GPT-5.6 TerraDefaultBalanced.',
        'GPT-5.6 LunaFastest.',
    ]);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
});

it('reports a pick', async () => {
    const { onChange } = setup({ value: '' });
    fireEvent.click(await screen.findByRole('button'));
    fireEvent.click(await screen.findByRole('option', { name: /Sol/ }));

    expect(onChange).toHaveBeenCalledWith('gpt-5.6-sol');
    // The panel closes on a pick; leaving it open over the composer would cover the field
    // the reader is about to type in.
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument());
});

it('does not re-report the model already in use', async () => {
    const { onChange } = setup({ value: 'gpt-5.6-sol' });
    fireEvent.click(await screen.findByRole('button'));
    fireEvent.click(await screen.findByRole('option', { name: /Sol/ }));
    expect(onChange).not.toHaveBeenCalled();
});

it('renders nothing until the catalogue arrives, rather than a name that then changes', async () => {
    let resolve;
    fetchModelCatalog.mockReturnValue(new Promise((r) => { resolve = r; }));
    setup({ value: '' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await act(async () => { resolve(CATALOG); });
    expect(screen.getByText('GPT-5.6 Terra')).toBeInTheDocument();
});

it('still renders when the catalogue request fails and the service falls back', async () => {
    // The service resolves to its fallback rather than rejecting, so the picker's only job
    // here is to not care. A picker that disappeared on a failed fetch would leave a reader
    // unable to see which model is answering.
    fetchModelCatalog.mockResolvedValue({
        models: [{ id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced.' }],
        defaultModel: 'gpt-5.6-terra',
    });
    setup({ value: '' });
    expect(await screen.findByText('GPT-5.6 Terra')).toBeInTheDocument();
});

it('is not operable once the query limit is reached', async () => {
    setup({ value: 'gpt-5.6-sol', disabled: true });
    const trigger = await screen.findByRole('button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
});


describe('a chip with no room for the full name', () => {
    it('abbreviates on a narrow viewport', async () => {
        // Four controls share the composer's row on a phone. Left at full width the chip is
        // the one that truncates, and "GPT-5.…" names no model at all.
        setViewport(true);
        setup({ value: 'gpt-5.6-terra' });
        expect(await screen.findByText('5.6 Terra')).toBeInTheDocument();
        expect(screen.queryByText('GPT-5.6 Terra')).not.toBeInTheDocument();
    });

    it('still announces the full name to a screen reader', async () => {
        setViewport(true);
        setup({ value: 'gpt-5.6-terra' });
        expect(await screen.findByRole('button', { name: 'Model: GPT-5.6 Terra' }))
            .toBeInTheDocument();
    });

    it('keeps full names in the panel, where there is room to compare', async () => {
        setViewport(true);
        setup({ value: 'gpt-5.6-terra' });
        fireEvent.click(await screen.findByRole('button'));
        const options = await screen.findAllByRole('option');
        expect(options.map((o) => o.textContent)).toEqual([
            'GPT-5.6 SolMost capable.',
            'GPT-5.6 TerraDefaultBalanced.',
            'GPT-5.6 LunaFastest.',
        ]);
    });

    it('falls back to the full name when the catalogue carries no short one', async () => {
        // A backend older than this build sends no `short_label`. An overflowing full name
        // still reads better than an abbreviation invented in the client.
        setViewport(true);
        fetchModelCatalog.mockResolvedValue({
            models: [{ id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced.' }],
            defaultModel: 'gpt-5.6-terra',
        });
        setup({ value: 'gpt-5.6-terra' });
        expect(await screen.findByText('GPT-5.6 Terra')).toBeInTheDocument();
    });
});


describe('pipeline eligibility', () => {
    it('offers every model on chat', async () => {
        setup({ value: '', pipeline: 'chat' });
        expect(await screen.findByRole('button')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button'));
        expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
            'GPT-5.6 SolMost capable.',
            'GPT-5.6 TerraDefaultBalanced.',
            'GPT-5.6 LunaFastest.',
        ]);
    });

    it('hides the chat-only model on deep research', async () => {
        // Deep research escalates a load-bearing claim from the cheap tier to the heavy tier
        // to get a BETTER judgement. A cheap-class model in the heavy slot collapses that
        // two-tier check into one, so it is not offered rather than offered and warned about.
        setup({ value: '', pipeline: 'deep_research' });
        fireEvent.click(await screen.findByRole('button'));
        const labels = (await screen.findAllByRole('option')).map((o) => o.textContent);
        expect(labels).toHaveLength(2);
        expect(labels.join(' ')).not.toContain('Luna');
    });

    it('swaps a model the pipeline does not offer, and says so through onResolveDefault', async () => {
        // The reader picked Luna for chat, then turned Investigate on. Sending it would be a
        // 400 they cannot act on; substituting silently would be worse. The chip changes.
        const { onResolveDefault } = setup({ value: 'gpt-5.6-luna', pipeline: 'deep_research' });
        expect(await screen.findByText('GPT-5.6 Terra')).toBeInTheDocument();
        await waitFor(() => expect(onResolveDefault).toHaveBeenCalledWith('gpt-5.6-terra'));
    });

    it('does not swap a model the pipeline does offer', async () => {
        const { onResolveDefault } = setup({ value: 'gpt-5.6-sol', pipeline: 'deep_research' });
        expect(await screen.findByText('GPT-5.6 Sol')).toBeInTheDocument();
        expect(onResolveDefault).not.toHaveBeenCalled();
    });

    it('treats a row with no pipelines field as eligible everywhere', async () => {
        // A backend older than this build sends no `pipelines`. Hiding every model would be a
        // worse failure than offering one the request path might refuse.
        fetchModelCatalog.mockResolvedValue({
            models: [{ id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced.' }],
            defaultModel: 'gpt-5.6-terra',
        });
        setup({ value: '', pipeline: 'deep_research' });
        expect(await screen.findByText('GPT-5.6 Terra')).toBeInTheDocument();
    });
});
