/**
 * Literature Review — its own page, its own pipeline.
 *
 *   /literature-review              write a new review (the topic may arrive from the home box)
 *   /literature-review/:publicId    a saved review, reopened from History or a link
 *
 * Independent of the chat page on purpose: the chat page's state machine carries "Investigate or
 * not" as one boolean through queues, recovery snapshots and reload logic, and a third mode
 * threaded through all of that would tie this feature to code it must stay apart from. Here a
 * review is one request (service/LiteratureReview.js) and one saved conversation labelled
 * mode="literature_review". Behind LITERATURE_REVIEW_ENABLED (config/features.js); with the flag
 * off the routes redirect home and this component is never mounted.
 *
 * A review takes minutes. The backend owns the run (a detached task), so leaving this page does
 * not stop it: the review is saved into History when it finishes, and reopening it here shows it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Alert, Box, Button, LinearProgress, MenuItem, Select, TextField, Typography,
} from '@mui/material';

import { useAuth } from '../Auth/AuthContext';
import { getChatHistoryDetailByPublicId } from '../../service/ChatHistory';
import { cancelReview, fetchReviewModels, streamReview } from '../../service/LiteratureReview';

const REMARK_PLUGINS = [remarkGfm];

const STAGES = [
    { id: 'acquisition', label: 'Search & select literature' },
    { id: 'synthesis', label: 'Synthesise evidence' },
    { id: 'planning', label: 'Plan' },
    { id: 'writing', label: 'Write' },
];

const PENDING_RECHECK_MS = 15000;

const formatSeconds = (s) => {
    if (!Number.isFinite(s)) return '';
    const m = Math.floor(s / 60);
    return m ? `${m} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`;
};

export default function LiteratureReview() {
    const { publicId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();

    const [topic, setTopic] = useState(location.state?.initialQuery || '');
    const [models, setModels] = useState([]);
    const [model, setModel] = useState('');
    const [status, setStatus] = useState('idle'); // idle | running | done | error | loading
    const [progress, setProgress] = useState(null);
    const [review, setReview] = useState(null); // { markdown, usage, executionTime }
    const [error, setError] = useState('');
    const [savedQuestion, setSavedQuestion] = useState('');
    const runIdRef = useRef(null);
    const abortRef = useRef(null);
    const startedAtRef = useRef(null);
    // The address this page gave the review it just wrote; reaching it must not reload the review.
    const ownPublicIdRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    // A saved review that is still being written is re-checked on this tick (see PENDING_RECHECK_MS).
    const [recheck, setRecheck] = useState(0);

    useEffect(() => {
        fetchReviewModels()
            .then((data) => {
                setModels(data?.models || []);
                setModel((current) => current || data?.default_model || data?.models?.[0]?.id || '');
            })
            .catch(() => setModels([]));
    }, []);

    // A saved review: load it from History. One still being written (reopened after a reload, or
    // from History mid-run) is looked at again every PENDING_RECHECK_MS until its answer is saved.
    useEffect(() => {
        if (!publicId || status === 'running' || publicId === ownPublicIdRef.current) return undefined;
        let alive = true;
        let timer = null;
        if (!recheck) setStatus('loading');
        getChatHistoryDetailByPublicId(publicId)
            .then((detail) => {
                if (!alive) return;
                const messages = detail?.messages || [];
                const question = [...messages].reverse().find((m) => m.role === 'user');
                const answer = [...messages].reverse().find((m) => m.role === 'assistant');
                setSavedQuestion(question?.content || '');
                if (answer?.content) {
                    setReview({ markdown: answer.content });
                    setStatus('done');
                } else {
                    setStatus('pending');
                    timer = setTimeout(() => setRecheck((n) => n + 1), PENDING_RECHECK_MS);
                }
            })
            .catch(() => {
                if (!alive) return;
                setError('This review could not be loaded.');
                setStatus('error');
            });
        return () => { alive = false; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicId, recheck]);

    useEffect(() => {
        if (status !== 'running') return undefined;
        const timer = setInterval(() => {
            setElapsed((Date.now() - (startedAtRef.current || Date.now())) / 1000);
        }, 1000);
        return () => clearInterval(timer);
    }, [status]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const start = useCallback(async () => {
        const question = topic.trim();
        if (question.length < 3) return;
        if (!isAuthenticated) {
            openLoginModal?.();
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        runIdRef.current = null;
        ownPublicIdRef.current = null;
        startedAtRef.current = Date.now();
        setElapsed(0);
        setError('');
        setReview(null);
        setSavedQuestion(question);
        setProgress({ phase: 'acquisition', label: 'Starting…', percent: 1, detail: {} });
        setStatus('running');
        let finished = false;
        try {
            await streamReview({ question, model, signal: controller.signal }, (frame) => {
                if (frame.run_id) runIdRef.current = frame.run_id;
                if (frame.step === 'Started' && frame.public_id) {
                    // The backend's first frame: the review already has its History entry. Take its
                    // address now, not at the end — a reload mid-run (or a laptop waking up) then
                    // reopens this review as "still being written" instead of an empty form.
                    ownPublicIdRef.current = frame.public_id;
                    navigate(`/literature-review/${frame.public_id}`, { replace: true });
                }
                if (frame.type === 'progress') {
                    setProgress({ phase: frame.phase, label: frame.label, percent: frame.percent,
                                  detail: frame.detail || {} });
                } else if (frame.step === 'Complete') {
                    finished = true;
                    setReview({ markdown: frame.response || '', usage: frame.usage,
                                executionTime: frame.execution_time });
                    setStatus('done');
                } else if (frame.step === 'Saved' && frame.public_id) {
                    // Give the review an address of its own, so a reload keeps it.
                    ownPublicIdRef.current = frame.public_id;
                    navigate(`/literature-review/${frame.public_id}`, { replace: true });
                } else if (frame.step === 'Error') {
                    finished = true;
                    setError(frame.error === 'stopped' ? 'The review was stopped.' : (frame.error || 'The review failed.'));
                    setStatus('error');
                }
            });
            if (!finished) {
                setError('The connection ended before the review finished. If it keeps running on the '
                    + 'server it will appear in History.');
                setStatus('error');
            }
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (err?.message || 'The review could not start.'));
            setStatus('error');
        }
    }, [topic, model, isAuthenticated, openLoginModal, navigate]);

    // Arriving from the home box with a topic: nothing else to choose but the model, so the form
    // stays up (the model is the cost lever: Sol is ~20x Luna) rather than starting on its own.

    const stop = useCallback(async () => {
        try {
            await cancelReview(runIdRef.current);
        } catch (err) {
            /* the stream's own Error frame reports the outcome */
        }
    }, []);

    const stageIndex = useMemo(
        () => Math.max(0, STAGES.findIndex((s) => s.id === progress?.phase)),
        [progress],
    );

    const cost = review?.usage?.totals?.cost_usd;
    const formShown = status === 'idle' || (status === 'error' && !publicId);

    return (
        <Box sx={{ maxWidth: 920, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
            <Typography variant="overline" sx={{ color: 'var(--color-text-tertiary)', letterSpacing: 1 }}>
                Literature Review · internal preview
            </Typography>

            {/* Hidden rather than unmounted while a review runs or is shown: the Topic field is MUI's
                TextareaAutosize, whose resize handler can fire just after its textarea is removed and
                then throws (getComputedStyle on null) — seen once in six runs of this page. */}
            <Box sx={{ mt: 1, flexDirection: 'column', gap: 2,
                       display: formShown ? 'flex' : 'none' }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>Write a literature review</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                    GLKB searches the literature, selects and synthesises the evidence, and writes a cited
                    review. It takes several minutes; you can leave this page and find the result in History.
                </Typography>
                <TextField
                    label="Topic"
                    multiline
                    minRows={2}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Mechanisms of osimertinib resistance in EGFR-mutant lung cancer"
                />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    {models.length > 0 && (
                        <Select size="small" value={model} onChange={(e) => setModel(e.target.value)}
                                aria-label="Model">
                            {models.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                    {m.label}{m.description ? ` — ${m.description}` : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    )}
                    <Button variant="contained" disableElevation onClick={start}
                            disabled={topic.trim().length < 3 || authLoading}
                            sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Write review
                    </Button>
                </Box>
                {formShown && error && <Alert severity="error">{error}</Alert>}
            </Box>

            {status === 'loading' && <LinearProgress sx={{ mt: 3 }} />}

            {(status === 'running' || status === 'done' || status === 'pending'
                || (status === 'error' && publicId)) && savedQuestion && (
                <Typography variant="h5" sx={{ fontWeight: 600, mt: 1 }}>{savedQuestion}</Typography>
            )}

            {status === 'running' && progress && (
                <Box sx={{ mt: 3, p: 2.5, borderRadius: 2, border: '1px solid var(--color-border-subtle, #e5e7eb)' }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                        {STAGES.map((s, i) => (
                            <Typography key={s.id} variant="caption" sx={{
                                px: 1, py: 0.25, borderRadius: 1,
                                fontWeight: i === stageIndex ? 700 : 500,
                                color: i <= stageIndex ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
                                background: i === stageIndex ? 'var(--color-brand-muted)' : 'transparent',
                            }}>
                                {i + 1}. {s.label}
                            </Typography>
                        ))}
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min(100, progress.percent || 0)} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="body2">{progress.label}</Typography>
                        <Typography variant="body2" sx={{ color: 'var(--color-text-tertiary)' }}>
                            {[
                                progress.detail?.searches ? `${progress.detail.searches} searches` : null,
                                progress.detail?.papers_opened ? `${progress.detail.papers_opened} papers read` : null,
                                progress.detail?.llm_calls ? `${progress.detail.llm_calls} model calls` : null,
                                formatSeconds(elapsed),
                            ].filter(Boolean).join(' · ')}
                        </Typography>
                    </Box>
                    <Button size="small" onClick={stop} sx={{ mt: 1.5, textTransform: 'none' }}>Stop</Button>
                </Box>
            )}

            {status === 'pending' && (
                <Alert severity="info" sx={{ mt: 3 }}>
                    This review is still being written. It appears here when it is finished (reviews take
                    15–25 minutes); you can leave this page and find it in History.
                </Alert>
            )}

            {status === 'error' && publicId && (
                <Box sx={{ mt: 3 }}>
                    <Alert severity="error">{error}</Alert>
                    {/* The topic is kept: after a Stop or a failure the likeliest next step is to run it again. */}
                    <Button sx={{ mt: 2, textTransform: 'none' }} onClick={() => {
                        setStatus('idle'); setError(''); setTopic((t) => t || savedQuestion);
                        navigate('/literature-review');
                    }}>
                        Try again
                    </Button>
                </Box>
            )}

            {status === 'done' && review && (
                <Box sx={{ mt: 3 }}>
                    {(Number.isFinite(cost) || review.executionTime) && (
                        <Typography variant="caption" sx={{ color: 'var(--color-text-tertiary)' }}>
                            {[review.executionTime ? formatSeconds(review.executionTime) : null,
                              Number.isFinite(cost) ? `$${cost.toFixed(3)}` : null].filter(Boolean).join(' · ')}
                        </Typography>
                    )}
                    <Box className="markdown-body" sx={{ mt: 1, '& h1': { display: 'none' } }}>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{review.markdown}</ReactMarkdown>
                    </Box>
                    <Button sx={{ mt: 3, textTransform: 'none' }} onClick={() => {
                        setStatus('idle'); setReview(null); setTopic(''); navigate('/literature-review');
                    }}>
                        Write another review
                    </Button>
                </Box>
            )}
        </Box>
    );
}
