import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import Graph from '../Graph';
import { requestGraphViewer } from '../../service/GraphViewer';
import { useAuth } from '../Auth/AuthContext';
import { GUEST_GRAPH_VIEWER_REASON } from '../../utils/refusals';

// Same bounded example as gkb2_frontend's GraphViewerQueryDialog.
export const EXAMPLE_REQUEST = {
    cypher: ['MATCH (n:Coding_element:Gene {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 6 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges'],
    core_nodes: ['ENSG00000001626'],
    max_nodes: 15,
    layout_mode: 'kg_only',
};
const noop = () => {};
const range = [0, 0];

export default function GraphViewer() {
    const [input, setInput] = useState(JSON.stringify(EXAMPLE_REQUEST, null, 2));
    const [result, setResult] = useState(null);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const activeRequest = useRef(null);
    const graphRef = useRef(null);
    useEffect(() => () => activeRequest.current?.abort(), []);
    /* Signed-in readers only (2026-10-09: a guest gets AI Chat and nothing else). A guest who
       lands here by URL is sent home with the sign-in overlay open, as /search does. */
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (authLoading || isAuthenticated) return;
        openLoginModal(GUEST_GRAPH_VIEWER_REASON);
        navigate('/', { replace: true });
    }, [authLoading, isAuthenticated, openLoginModal, navigate]);

    const submit = async (event) => {
        event.preventDefault();
        if (activeRequest.current) return;
        setError('');
        let request;
        try {
            request = JSON.parse(input);
            if (request.layout_mode && request.layout_mode !== 'kg_only') {
                throw new Error('This viewer supports kg_only layout; genome tracks are not supported.');
            }
        } catch (e) { setError(e.message); return; }
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        try {
            const next = await requestGraphViewer({ ...request, layout_mode: 'kg_only' }, { signal: controller.signal });
            if (!controller.signal.aborted) { setResult(next); setSelected(null); }
        } catch (e) {
            if (!controller.signal.aborted) setError(e.response?.data?.error?.message
                || (typeof e.response?.data?.error === 'string' && e.response.data.error)
                || e.message || 'Unable to load graph.');
        } finally {
            if (activeRequest.current === controller) {
                activeRequest.current = null;
                if (!controller.signal.aborted) setLoading(false);
            }
        }
    };
    const cancel = () => {
        activeRequest.current?.abort();
        activeRequest.current = null;
        setLoading(false);
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <Button component={Link} to="/search">Back to entity search</Button>
            <Typography component="h1" variant="h5" sx={{ my: 2 }}>Graph Viewer</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                Query the new graph backend using its JSON request format. Select a node or edge to inspect its properties.
            </Typography>
            <Box component="form" onSubmit={submit}>
                <TextField label="Graph query (JSON)" multiline minRows={6} maxRows={14} fullWidth
                    value={input} onChange={e => setInput(e.target.value)} disabled={loading}
                    inputProps={{ style: { fontFamily: 'Geist Mono, monospace', fontSize: 13 } }} />
                <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
                    <Button type="submit" variant="contained" disabled={loading || !input.trim()}>
                        {loading ? 'Loading graph…' : 'Run query'}
                    </Button>
                    {loading && <Button type="button" onClick={cancel}>Cancel</Button>}
                </Box>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}{result ? ' The previous graph is still shown.' : ''}</Alert>}
            {result && <>
                <Typography role="status" color="text.secondary">
                    {result.graph.nodes.length} nodes · {result.graph.edges.length} edges
                </Typography>
                {result.graph.nodes.length > 0 && <Button type="button" onClick={() => graphRef.current?.fit()}>Fit graph</Button>}
                {!result.graph.nodes.length ? <Typography>No nodes found.</Typography> :
                    <Graph ref={graphRef} data={result.graph} useServerLayout height="min(600px, 75vh)" gtdcFreq={range} gtdcNoc={range}
                        informationOpen={Boolean(selected)} handleSelect={setSelected} expandInformation={noop}
                        handleInformation={() => setSelected(null)} handleMinGtdcFreq={noop}
                        handleMaxGtdcFreq={noop} handleGtdcFreq={noop} handleMinGtdcNoc={noop}
                        handleMaxGtdcNoc={noop} handleGtdcNoc={noop} />}
                {selected && <Box component="pre" aria-label="Selected graph properties"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, color: 'text.secondary' }}>
                    {JSON.stringify(selected, null, 2)}
                </Box>}
            </>}
        </Box>
    );
}
