import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GraphViewer from './index';
import { requestGraphViewer } from '../../service/GraphViewer';

jest.mock('../../service/GraphViewer', () => ({ requestGraphViewer: jest.fn() }));
const mockAuth = { isAuthenticated: true, loading: false, openLoginModal: jest.fn() };
jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
jest.mock('../Graph', () => {
    const React = require('react');
    return { __esModule: true, default: React.forwardRef(({ data, handleSelect }, ref) => (
        <button onClick={() => handleSelect(data.nodes[0].data)}>Graph: {data.nodes[0].data.display}</button>
    )) };
});
// Exercise state transitions without loading the full MUI barrel in unit tests.
jest.mock('@mui/material', () => {
    const React = require('react');
    return {
        Box: ({ component: Component = 'div', sx, ...props }) => <Component {...props} />,
        Button: ({ component: Component = 'button', sx, variant, ...props }) => <Component {...props} />,
        Typography: ({ component: Component = 'p', sx, variant, color, ...props }) => <Component {...props} />,
        Alert: ({ severity, sx, ...props }) => <div role="alert" {...props} />,
        TextField: ({ label, value, onChange, disabled }) => (
            <label>{label}<textarea value={value} onChange={onChange} disabled={disabled} /></label>
        ),
    };
});
const graphResult = (display = 'CFTR') => ({ graph: { nodes: [{ data: { id: 'a', display } }], edges: [] } });
const mount = () => render(<MemoryRouter><GraphViewer /></MemoryRouter>);
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
beforeEach(() => {
    requestGraphViewer.mockReset();
    Object.assign(mockAuth, { isAuthenticated: true, loading: false });
    mockAuth.openLoginModal.mockReset();
    mockNavigate.mockReset();
});

it('sends a guest home with the sign-in overlay open (signed-in readers only, 2026-10-09)', () => {
    Object.assign(mockAuth, { isAuthenticated: false });
    mount();
    expect(mockAuth.openLoginModal).toHaveBeenCalledWith(expect.stringMatching(/Graph Viewer is available to signed-in users/));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    expect(requestGraphViewer).not.toHaveBeenCalled();
});

it('waits for the auth check before deciding', () => {
    Object.assign(mockAuth, { isAuthenticated: false, loading: true });
    mount();
    expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
});

it('does not query automatically, submits once and shows properties', async () => {
    requestGraphViewer.mockResolvedValue(graphResult());
    mount();
    expect(requestGraphViewer).not.toHaveBeenCalled();
    submit();
    expect(await screen.findByText('Graph: CFTR')).toBeTruthy();
    expect(requestGraphViewer).toHaveBeenCalledTimes(1);
    expect(requestGraphViewer.mock.calls[0][0].layout_mode).toBe('kg_only');
    fireEvent.click(screen.getByText('Graph: CFTR'));
    expect(screen.getByLabelText('Selected graph properties').textContent).toContain('CFTR');
});

it('rejects invalid JSON and unsupported genome layout locally', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Graph query (JSON)'), { target: { value: '{bad' } });
    submit();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Graph query (JSON)'), { target: { value: '{"layout_mode":"genome_mode"}' } });
    submit();
    expect(screen.getByRole('alert').textContent).toContain('not supported');
    expect(requestGraphViewer).not.toHaveBeenCalled();
});

it('keeps the last successful graph when a new request fails', async () => {
    requestGraphViewer.mockResolvedValueOnce(graphResult()).mockRejectedValueOnce(new Error('Network Error'));
    mount();
    submit();
    await screen.findByText('Graph: CFTR');
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('Network Error');
    expect(screen.getByText('Graph: CFTR')).toBeTruthy();
});

it('cancels a pending request and ignores its late result', async () => {
    let finish;
    requestGraphViewer.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
        .mockResolvedValueOnce(graphResult('ACE2'));
    mount();
    submit();
    expect(screen.getByRole('button', { name: 'Loading graph…' }).disabled).toBe(true);
    const signal = requestGraphViewer.mock.calls[0][1].signal;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal.aborted).toBe(true);
    submit();
    await screen.findByText('Graph: ACE2');
    await act(async () => finish(graphResult('stale')));
    expect(screen.queryByText('Graph: stale')).toBeNull();
    expect(screen.getByText('Graph: ACE2')).toBeTruthy();
});

it('aborts when navigating away', () => {
    requestGraphViewer.mockReturnValue(new Promise(() => {}));
    const view = mount();
    submit();
    const signal = requestGraphViewer.mock.calls[0][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
});

it('shows an empty graph result without mounting Cytoscape', async () => {
    requestGraphViewer.mockResolvedValue({ graph: { nodes: [], edges: [] } });
    mount();
    submit();
    await waitFor(() => expect(screen.getByText('No nodes found.')).toBeTruthy());
});
