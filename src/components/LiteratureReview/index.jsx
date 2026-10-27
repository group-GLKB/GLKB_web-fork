/**
 * Literature Review — its own page, its own pipeline.
 *
 *   /literature-review              set up and write a new review (the topic and scope may arrive
 *                                   from the home composer's Literature Review tab)
 *   /literature-review/:publicId    a saved review, reopened from History, Recent or a link
 *
 * The page walks the design's four steps — Scope, Outline, Writing, Review. Behind
 * LR_OUTLINE_APPROVAL_ENABLED (config/features.js), the run stops once the outline is planned
 * (`outline_approval`): the reader renames, reorders, resizes or leaves out sections and approves it
 * (OutlineStep), and only then is anything written. Nothing runs while they decide, and a reload —
 * or the mail saying the outline is ready — finds it again (getReviewRun). Off, Outline is a step the
 * run passes through, not one the reader edits.
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
import './LiteratureReview.css';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, LinearProgress, useMediaQuery } from '@mui/material';

import { useAuth } from '../Auth/AuthContext';
import { getChatHistoryDetailByPublicId } from '../../service/ChatHistory';
import {
    approveOutline, cancelReview, getReviewRun, reviewRefusal, streamReview,
    runParagraphAction, saveReview, sha256Hex,
} from '../../service/LiteratureReview';
import { applyStreamCredits, fetchUsage } from '../../service/credits';
import { refusalText } from '../../utils/refusals';
import { fetchCitations } from '../../service/Citation';
import { getTierPref, setTierPref } from '../../service/serviceTiers';
import { CHAT_HOME_PATH } from '../../config/entryRoutes';
import { LR_OUTLINE_APPROVAL_ENABLED } from '../../config/features';
import { latexFilename, reviewToLatex } from '../../utils/reviewToLatex';
import { exportFilename, reviewTitle, reviewToPrintable, reviewToWord } from '../../utils/reviewExport';
import { trackGtagEvent } from '../../utils/gtag';
import { effectiveSources, initialScope } from '../HomePage/ReviewScope';
import { useAttachments } from '../Units/AttachmentChips';
import { OptionItem, OptionPanel } from '../Units/OptionMenu';
import { REVIEW_PAPER_LIMITS } from '../../service/attachments';
import { setStylePref, styleById, styleMarkdown } from './citationStyle';
import { PhoneTopBar, TopBar } from './Chrome';
import OutlineStep from './OutlineStep';
import ScopeStep from './ScopeStep';
import WritingStep from './WritingStep';
import ReviewDocument from './ReviewDocument';
import ExportDialog from './ExportDialog';
import { countWords, parseReview, renumberReview, replaceParagraph } from './reviewModel';

const PENDING_RECHECK_MS = 15000;

const formatDate = (value) => {
    const d = value ? new Date(value) : new Date();
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function LiteratureReview() {
    const { publicId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();

    const [topic, setTopic] = useState(location.state?.initialQuery || '');
    const [scope, setScope] = useState(() => ({ ...initialScope(), ...(location.state?.scope || {}) }));
    // The chat's own model picker: a service tier, which the review service maps to a model.
    const [serviceTier, setServiceTier] = useState(() => location.state?.serviceTier || getTierPref());
    const [status, setStatus] = useState('idle'); // idle | running | outline | done | error | loading | pending
    const [progress, setProgress] = useState(null);
    // The outline's sections and where each one is, once the run has planned them ({ title, rows }).
    const [sections, setSections] = useState(null);
    // The outline the run stopped at, waiting for the reader's approval ({ title, thesis, words, sections }).
    const [outline, setOutline] = useState(null);
    const [review, setReview] = useState(null); // { markdown, references, usage, executionTime, createdAt }
    // NCBI's record for each cited PMID, which the citation style formats ({} until it arrives).
    const [records, setRecords] = useState({});
    const [error, setError] = useState('');
    const [savedQuestion, setSavedQuestion] = useState('');
    // The reader's own papers: uploaded here, or on the home bar and carried over (already uploaded).
    const papers = useAttachments({
        limits: REVIEW_PAPER_LIMITS,
        initial: location.state?.papers,
        onRequireSignIn: () => openLoginModal?.(),
    });
    const paperIds = papers.readyAttachments.map((a) => a.id);
    const sources = effectiveSources(scope, paperIds.length);
    // The papers a saved review was written from (its prompt's attachments), and how many a run uses.
    const [savedPapers, setSavedPapers] = useState([]);
    const [exportAnchor, setExportAnchor] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const runIdRef = useRef(null);
    // The app's phone breakpoint (Layout): the phone design's own bar and pages below it.
    const isPhone = useMediaQuery('(max-width:767px)');

    /* The review as a compilable .tex (utils/reviewToLatex.js). Done here rather than on the
       server because the markdown is already in hand, including for a review reopened from
       History, so nothing has to be fetched or kept in sync. */
    const saveFile = useCallback((text, type, name, format) => {
        const url = window.URL.createObjectURL(new Blob([text], { type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        trackGtagEvent('literature_review_export', { format });
    }, []);

    // The review as the exports write it: in the citation style the page shows.
    const styled = useCallback(() => styleMarkdown(review?.markdown, review?.references, records, scope.citationStyle),
        [review, records, scope.citationStyle]);

    const downloadLatex = useCallback(() => {
        if (!review?.markdown) return;
        const title = savedQuestion || topic;
        saveFile(reviewToLatex(styled(), { title }), 'application/x-tex',
                 latexFilename(title), 'latex');
    }, [review, savedQuestion, topic, saveFile, styled]);

    const downloadWord = useCallback(() => {
        if (!review?.markdown) return;
        const title = savedQuestion || topic;
        saveFile(reviewToWord(styled(), { title }), 'application/msword',
                 exportFilename(reviewTitle(review.markdown, title), 'doc'), 'word');
    }, [review, savedQuestion, topic, saveFile, styled]);

    /* PDF goes through the browser's own print dialog ("Save as PDF") rather than a PDF library:
       on a 6,000-word review the browser paginates, keeps headings with their text and hyphenates,
       which a canvas-based writer does not. The window is opened on a click, so the popup blocker
       allows it; if a blocker stops it anyway, say so instead of failing silently. */
    const downloadPdf = useCallback(() => {
        if (!review?.markdown) return;
        const title = savedQuestion || topic;
        const w = window.open('', '_blank');
        if (!w) { setError('Allow pop-ups for this site to save the review as a PDF.'); return; }
        w.document.write(reviewToPrintable(styled(), { title }));
        w.document.close();
        w.focus();
        // Let the styles apply before the dialog takes its snapshot of the page.
        setTimeout(() => w.print(), 300);
        trackGtagEvent('literature_review_export', { format: 'pdf' });
    }, [review, savedQuestion, topic, styled]);
    const abortRef = useRef(null);
    const startedAtRef = useRef(null);
    // The address this page gave the review it just wrote; reaching it must not reload the review.
    const ownPublicIdRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    // A saved review that is still being written is re-checked on this tick (see PENDING_RECHECK_MS).
    const [recheck, setRecheck] = useState(0);

    // The cited papers' records, for the citation style. A review's references carry a title, year
    // and DOI; the authors, journal, volume and pages a style needs come from NCBI (service/Citation).
    useEffect(() => {
        const pmids = (review?.references || []).map((r) => r.pmid).filter(Boolean);
        if (!pmids.length) return undefined;
        let alive = true;
        fetchCitations(pmids).then((found) => { if (alive) setRecords(found || {}); });
        return () => { alive = false; };
    }, [review?.references]);

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
                setSavedPapers(Array.isArray(question?.attachments) ? question.attachments : []);
                if (answer?.content) {
                    setReview({ markdown: answer.content, references: answer.references || [],
                                createdAt: answer.created_at || detail?.created_at });
                    setStatus('done');
                    return;
                }
                // Not answered yet: an outline waiting for the reader, or a review still being written.
                const wait = () => {
                    setStatus('pending');
                    timer = setTimeout(() => setRecheck((n) => n + 1), PENDING_RECHECK_MS);
                };
                if (!LR_OUTLINE_APPROVAL_ENABLED) {
                    wait();
                    return;
                }
                getReviewRun(publicId).then((run) => {
                    if (!alive) return;
                    if (run?.status === 'outline' && run.outline) {
                        runIdRef.current = run.run_id;
                        setOutline(run.outline);
                        setStatus('outline');
                    } else {
                        wait();
                    }
                }).catch(() => { if (alive) wait(); });
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

    /* What a run's frames do to the page (the first run and the approved outline's alike). `run.finished`
       says whether the stream ended the way a run should: a review, an outline, or an error. */
    const onFrame = useCallback((run) => (frame) => {
        if (frame.run_id) runIdRef.current = frame.run_id;
        // A review is charged (2026-10-13): the frame that ends it carries the balance; without a
        // usable figure the balance is read again.
        if (frame.credits && !applyStreamCredits(frame.credits)) fetchUsage({ isAuthenticated: true });
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
        } else if (frame.type === 'sections') {
            setSections({ title: frame.title || '', rows: Array.isArray(frame.sections) ? frame.sections : [] });
        } else if (frame.step === 'Outline') {
            run.finished = true;
            setOutline(frame.outline || null);
            setStatus('outline');
        } else if (frame.step === 'Complete') {
            run.finished = true;
            setOutline(null);
            setReview({ markdown: frame.response || '', references: frame.references || [],
                        usage: frame.usage, executionTime: frame.execution_time });
            setStatus('done');
        } else if (frame.step === 'Saved' && frame.public_id) {
            // Give the review an address of its own, so a reload keeps it.
            ownPublicIdRef.current = frame.public_id;
            navigate(`/literature-review/${frame.public_id}`, { replace: true });
        } else if (frame.step === 'Error') {
            run.finished = true;
            setError(frame.error === 'stopped' ? 'The review was stopped.' : (frame.error || 'The review failed.'));
            // An approval the service refused ran nothing: the outline still waits.
            setStatus(run.approving && frame.status === 400 ? 'outline' : 'error');
        }
    }, [navigate]);

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
        const usedPapers = sources === 'search' ? [] : papers.readyAttachments;
        setSavedPapers(usedPapers);
        setProgress({ phase: sources === 'papers' ? 'synthesis' : 'acquisition', label: 'Starting…',
                      percent: 1, detail: {} });
        setSections(null);
        setStatus('running');
        trackGtagEvent('literature_review_start', { target_words: scope.targetWords || 0, sources,
                                                    papers: usedPapers.length });
        const run = { finished: false };
        try {
            await streamReview({
                question, serviceTier, signal: controller.signal, articleTypes: scope.articleTypes,
                targetWords: scope.targetWords, cutoffYear: scope.cutoffYear,
                // The years filter what GLKB searches; the reader's own papers are all used.
                startYear: sources === 'papers' ? null : scope.startYear,
                notify: scope.notify !== false,
                papers: usedPapers.map((a) => a.id), sources,
                outlineApproval: LR_OUTLINE_APPROVAL_ENABLED,
            }, onFrame(run));
            if (!run.finished) {
                setError('The connection ended before the review finished. If it keeps running on the '
                    + 'server it will appear in History.');
                setStatus('error');
            }
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
            // Refused before anything ran — not enough credits names the price and a cheaper choice.
            const refusal = reviewRefusal(err);
            setError(refusal?.code ? refusalText(refusal)
                : (refusal?.message || err?.message || 'The review could not start.'));
            setStatus('error');
        }
    }, [topic, serviceTier, scope, sources, papers.readyAttachments, isAuthenticated, openLoginModal, onFrame]);

    /* Write the outline as the reader approved it: the same frames as the first run, into the same
       conversation. An approval the service finds does not fit (a 400: nothing ran) leaves the outline
       waiting, with the reason; one already approved elsewhere (a 409) is being written. */
    const approve = useCallback(async ({ title, sections: chosen }) => {
        const runId = runIdRef.current;
        if (!runId) return;
        const controller = new AbortController();
        abortRef.current = controller;
        startedAtRef.current = Date.now();
        setElapsed(0);
        setError('');
        setSections(null);
        setProgress({ phase: 'writing', label: 'Writing the review…', percent: 80, detail: {} });
        setStatus('running');
        trackGtagEvent('literature_review_outline_approve', { sections: chosen.length,
                                                              words: chosen.reduce((n, x) => n + (x.words || 0), 0) });
        const run = { finished: false, approving: true };
        try {
            await approveOutline({ runId, title, sections: chosen, signal: controller.signal }, onFrame(run));
            if (!run.finished) {
                setError('The connection ended before the review finished. If it keeps running on the '
                    + 'server it will appear in History.');
                setStatus('error');
            }
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
            const detail = err?.response?.data?.detail;
            if (err?.response?.status === 409) {
                // Approved already (another tab, another device): it is being written; look again.
                ownPublicIdRef.current = null;
                setStatus('pending');
                setRecheck((n) => n + 1);
                return;
            }
            setError(typeof detail === 'string' ? detail : (err?.message || 'The review could not start.'));
            setStatus('outline');
        }
    }, [onFrame]);

    /* Change the scope: the outline is discarded (the prompt is answered as stopped) and Step 1 opens
       again with the topic and the scope the outline was planned with — the run's own record of it,
       which a reload keeps when the page's state does not. */
    const changeScope = useCallback(async () => {
        try {
            await cancelReview(runIdRef.current);
        } catch (err) {
            /* nothing was running; the outline is left as it was */
        }
        trackGtagEvent('literature_review_outline_discard', {});
        const planned = outline?.scope || {};
        setScope((s) => ({
            ...s,
            ...(planned.target_words ? { targetWords: planned.target_words } : {}),
            ...('start_year' in planned ? { startYear: planned.start_year || null } : {}),
            // The service fills in this year when none was chosen, which the form shows as no end year.
            ...(planned.cutoff_year
                ? { cutoffYear: planned.cutoff_year >= new Date().getFullYear() ? null : planned.cutoff_year } : {}),
            ...(planned.article_types ? { articleTypes: planned.article_types } : {}),
        }));
        setOutline(null);
        setError('');
        setTopic((t) => t || savedQuestion);
        setStatus('idle');
        navigate('/literature-review');
    }, [navigate, savedQuestion, outline]);

    const stop = useCallback(async () => {
        try {
            await cancelReview(runIdRef.current);
        } catch (err) {
            /* the stream's own Error frame reports the outcome */
        }
    }, []);

    const startNew = () => {
        // The papers belong to the review they were sent with; a new one starts with none.
        papers.clear(); setSavedPapers([]);
        setStatus('idle'); setReview(null); setError(''); setTopic(''); navigate('/literature-review');
    };

    /* The paragraph actions (Ask / Rewrite / Shorten / Add evidence) of a saved review, on the text the
       reader selected: the review service suggests, the reader accepts or not. Accepting replaces the
       paragraph (the selection within it), numbers the citations again by first appearance (new
       evidence included), and saves the whole review; the backend keeps the version it replaced, and
       the last edit can be put back (Undo). */
    const [lastEdit, setLastEdit] = useState(null);
    const paragraphAction = useCallback((action, paragraph, question, history, selection) => {
        trackGtagEvent('literature_review_paragraph_action', {
            action, directed: Boolean(question), turn: (history?.length || 0) + 1, selection: Boolean(selection),
        });
        return runParagraphAction(publicId, { action, paragraph, question, history, selection });
    }, [publicId]);
    const acceptParagraph = useCallback(async (paragraph, result) => {
        const replaced = replaceParagraph(review.markdown, paragraph, result.paragraph);
        if (replaced == null) throw new Error('This paragraph changed. Reload the review and try again.');
        const next = renumberReview(replaced, [...(review.references || []), ...(result.new_references || [])]);
        await saveReview(publicId, { ...next, baseSha: await sha256Hex(review.markdown) });
        trackGtagEvent('literature_review_paragraph_accept', { action: result.action, selection: Boolean(result.replacement) });
        setLastEdit({ markdown: review.markdown, references: review.references, after: next.markdown });
        setReview((r) => ({ ...r, markdown: next.markdown, references: next.references }));
    }, [publicId, review]);
    const undoParagraph = useCallback(async () => {
        if (!lastEdit || review?.markdown !== lastEdit.after) throw new Error('This review changed since; the edit cannot be put back.');
        await saveReview(publicId, { markdown: lastEdit.markdown, references: lastEdit.references,
                                     baseSha: await sha256Hex(review.markdown) });
        trackGtagEvent('literature_review_paragraph_undo', {});
        setReview((r) => ({ ...r, markdown: lastEdit.markdown, references: lastEdit.references }));
        setLastEdit(null);
    }, [publicId, review, lastEdit]);

    const share = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { setError('Copy the address from the browser bar to share this review.'); }
    };

    const formShown = status === 'idle' || (status === 'error' && !publicId);
    const writing = status === 'running' || status === 'pending';
    const step = formShown ? 0 : writing ? (progress?.phase === 'writing' ? 2 : 1) : status === 'done' ? 3 : 1;
    const minutes = review?.executionTime ? Math.max(1, Math.round(review.executionTime / 60)) : null;

    const exportItems = [
        { id: 'word', label: 'Word (.doc)', hint: 'To edit in Word or Google Docs', run: downloadWord },
        { id: 'pdf', label: 'PDF', hint: 'Saved from the print dialog', run: downloadPdf },
        { id: 'latex', label: 'LaTeX (.tex)', hint: 'A .tex file to compile', run: downloadLatex },
    ];
    const exportMenu = (items) => (
        <OptionPanel anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}
                     label="Export" role="menu" className="lr-pop">
            {items.map((x) => (
                <OptionItem key={x.id} role="menuitem" label={x.label} hint={x.hint}
                            onClick={() => { setExportAnchor(null); x.run(); }} />
            ))}
        </OptionPanel>
    );
    // On a phone the bar has room for Export alone (the phone design); sharing is its first row.
    const phoneAction = status === 'done' && review ? (
        <>
            <button type="button" className="lr-primary is-small" aria-haspopup="menu" aria-expanded={Boolean(exportAnchor)}
                    onClick={(e) => setExportAnchor(exportAnchor ? null : e.currentTarget)}>
                {copied ? 'Copied' : 'Export'}
            </button>
            {exportMenu([
                { id: 'link', label: 'Copy link', hint: 'To share this review', run: share },
                ...exportItems,
            ])}
        </>
    ) : null;

    // The export dialog's line: what is being exported.
    const exportSummary = useMemo(() => {
        if (!review?.markdown) return '';
        const parsed = parseReview(review.markdown, review.references);
        const words = parsed.audit?.words ?? countWords(parsed);
        const n = parsed.references.length;
        return [`${words.toLocaleString('en-US')} words`, `${n} reference${n === 1 ? '' : 's'}`,
                styleById(scope.citationStyle).label].join(' · ');
    }, [review, scope.citationStyle]);
    const runExport = (format) => ({ latex: downloadLatex, word: downloadWord, pdf: downloadPdf }[format] || downloadLatex)();
    const changeStyle = (id) => { setScope((s) => ({ ...s, citationStyle: id })); setStylePref(id); };

    const actions = status === 'done' && review ? (
        <>
            <button type="button" className="lr-btn-secondary" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            <button type="button" className="lr-btn-primary" aria-haspopup="dialog" onClick={() => setExportOpen(true)}>
                Export
            </button>
            <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} summary={exportSummary}
                          citationStyle={scope.citationStyle} onCitationStyle={changeStyle} onExport={runExport} />
        </>
    ) : null;

    return (
        <div className="lr-root">
            {isPhone
                ? <PhoneTopBar step={step} onHome={() => navigate(CHAT_HOME_PATH)} onNew={startNew} action={phoneAction} />
                : <TopBar step={step} onHome={() => navigate(CHAT_HOME_PATH)} onNew={startNew} actions={actions} />}

            {/* Hidden rather than unmounted while a review runs or is shown: the old form's MUI
                TextareaAutosize could throw on unmount; the textarea here is plain, but the form
                keeps its state either way. */}
            <div style={{ display: formShown ? 'block' : 'none' }}>
                <ScopeStep
                    topic={topic}
                    onTopic={setTopic}
                    scope={scope}
                    onScope={setScope}
                    serviceTier={serviceTier}
                    onServiceTier={(tier) => { setServiceTier(tier); setTierPref(tier); }}
                    onResolveTier={setServiceTier}
                    onStart={start}
                    canStart={topic.trim().length >= 3 && !authLoading && !papers.isUploading && !papers.hasErrors}
                    error={formShown ? error : ''}
                    papers={papers}
                    sources={sources}
                    phone={isPhone}
                />
            </div>

            {status === 'loading' && <LinearProgress sx={{ mx: 4, mt: 4 }} />}

            {status === 'outline' && outline && (
                <OutlineStep key={runIdRef.current || 'outline'} outline={outline} topic={savedQuestion}
                             scope={scope} citationStyle={scope.citationStyle} yourPapers={savedPapers.length}
                             onApprove={approve} onChangeScope={changeScope} error={error} phone={isPhone} />
            )}

            {writing && (
                <WritingStep
                    topic={savedQuestion}
                    progress={progress}
                    elapsed={elapsed}
                    targetWords={scope.targetWords}
                    papers={savedPapers.length}
                    papersOnly={status === 'running' && sources === 'papers'}
                    notify={status === 'running' && scope.notify !== false}
                    pending={status === 'pending'}
                    onStop={status === 'running' ? stop : null}
                    sections={status === 'running' ? sections?.rows : null}
                    phone={isPhone}
                />
            )}
            {status === 'pending' && (
                <div className="lr-page"><div className="lr-main is-narrow">
                    <Alert severity="info">
                        This review is still being written. It appears here when it is finished (reviews take
                        8–12 minutes); you can leave this page and find it in History.
                    </Alert>
                </div></div>
            )}

            {status === 'error' && publicId && (
                <div className="lr-page"><div className="lr-main is-narrow">
                    {savedQuestion && <h1 className="lr-title">{savedQuestion}</h1>}
                    <Alert severity="error">{error}</Alert>
                    {/* The topic is kept: after a Stop or a failure the likeliest next step is to run it again. */}
                    <button type="button" className="lr-secondary" style={{ marginTop: 16 }} onClick={() => {
                        setStatus('idle'); setError(''); setTopic((t) => t || savedQuestion);
                        navigate('/literature-review');
                    }}>
                        Try again
                    </button>
                </div></div>
            )}

            {status === 'done' && review && (
                <>
                    {/* An export that cannot run says so here: the error Alert above only renders
                        in the error state, so on a finished review it would show nothing at all. */}
                    {error && <Alert severity="warning" sx={{ mx: 4, mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
                    <ReviewDocument
                        markdown={review.markdown}
                        references={review.references}
                        records={records}
                        citationStyle={scope.citationStyle}
                        onCitationStyle={changeStyle}
                        meta={{
                            topic: savedQuestion,
                            targetWords: scope.targetWords,
                            startYear: scope.startYear,
                            cutoffYear: scope.cutoffYear,
                            generated: formatDate(review.createdAt),
                            minutes,
                            papers: savedPapers.length,
                        }}
                        onParagraph={publicId ? paragraphAction : undefined}
                        onAccept={publicId ? acceptParagraph : undefined}
                        onUndo={publicId && lastEdit ? undoParagraph : undefined}
                        phone={isPhone}
                    />
                </>
            )}
        </div>
    );
}
