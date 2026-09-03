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
jest.mock('../../../service/models', () => ({
    fetchModelCatalog: jest.fn(),
    modelLabel: (id, models) => (models || []).find((m) => m.id === id)?.label || id,
}));

const CATALOG = {
    models: [
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: 'Most capable.' },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced.' },
        { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Fastest.' },
    ],
    defaultModel: 'gpt-5.6-terra',
};

beforeEach(() => {
    fetchModelCatalog.mockReset();
    fetchModelCatalog.mockResolvedValue(CATALOG);
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
    // services independently agreeing on what "unspecified" means.
    expect(onResolveDefault).toHaveBeenCalledWith('gpt-5.6-terra');
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
