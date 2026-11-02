import React, { useEffect, useRef, useState } from 'react';
import { Alert, Switch } from '@mui/material';

import {
    ARTICLE_TYPES, CustomLength, LengthOptions, SEARCH_ONLY_FILTER, sourceById, sourceOptions, sourcesPatch, YearRange,
    yearsLabel,
} from '../HomePage/ReviewScope';
import BetaBadge from '../Units/BetaBadge';
import TierPicker from '../Units/TierPicker';
import { OptionDropdown, OptionSelect } from '../Units/OptionMenu';
import { AttachmentChips, attachmentBlockedNote, dragHasFiles, filesFromTransfer } from '../Units/AttachmentChips';
import { PAPER_ACCEPT, PAPER_FORMATS_TEXT, REVIEW_PAPER_LIMITS } from '../../service/attachments';
import { REVIEW_STYLES, styleById } from './citationStyle';
import { LR_OUTLINE_APPROVAL_ENABLED } from '../../config/features';
import { creditsFor, fetchTierPricing } from '../../service/serviceTiers';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: the outline
 * page's "Scope" card). Length, the years and the article types reach the pipeline; the
 * citation style is the page's own (it can be changed on the finished review too); the model is
 * picked with the chat's own picker, as a service tier. Sources says where the literature comes
 * from — GLKB's search, the reader's own papers, or both — and the papers are added here (or
 * dropped on the card). The dropdowns are the app's own (Units/OptionMenu), as the Model row's.
 */

/** What the review will do, in a sentence, for the sources chosen. */
const lede = (sources, n) => (LR_OUTLINE_APPROVAL_ENABLED ? approvalLede(sources, n) : straightLede(sources, n));

/** The same, for a review written straight through (no outline approval). */
const straightLede = (sources, n) => {
    const yours = `your ${n === 1 ? 'paper' : `${n} papers`}`;
    if (sources === 'papers') {
        return `GLKB reviews ${yours} alone: it synthesises their evidence, reading each one in full, `
            + 'outlines the review and writes it with every claim cited. Nothing runs until you start it.';
    }
    if (sources === 'papers_and_search') {
        return `GLKB searches PubMed and its knowledge graph, selects the evidence and reads it together with ${yours}, `
            + 'then outlines the review and writes it with every claim cited. Nothing runs until you start it.';
    }
    return 'GLKB searches PubMed and its knowledge graph, selects and synthesises the evidence, outlines the review '
        + 'and writes it with every claim cited. Add your own papers to review them too, or only them. '
        + 'Nothing runs until you start it.';
};

const approvalLede = (sources, n) => {
    const yours = `your ${n === 1 ? 'paper' : `${n} papers`}`;
    if (sources === 'papers') {
        return `GLKB reviews ${yours} alone: it synthesises their evidence, reading each one in full, and `
            + 'outlines the review. You approve the outline, then it writes the review with every claim cited.';
    }
    if (sources === 'papers_and_search') {
        return `GLKB searches PubMed and its knowledge graph, selects the evidence and reads it together with ${yours}, `
            + 'then outlines the review. You approve the outline, then it writes the review with every claim cited.';
    }
    return 'GLKB searches PubMed and its knowledge graph, selects and synthesises the evidence and outlines the '
        + 'review. You approve the outline, then it writes the review with every claim cited. Add your own papers '
        + 'to review them too, or only them.';
};

/** The phone design's length cards: four presets, each named for what it reads as. */
export const PHONE_LENGTHS = [
    { words: 2000, label: 'Brief overview' },
    { words: 4000, label: 'Typical review' },
    { words: 6000, label: 'In-depth' },
    { words: 8000, label: 'Comprehensive' },
];

/** The phone page's line under its title: the phone design's, once the outline is approved first. */
const phoneLede = (sources, n) => {
    if (LR_OUTLINE_APPROVAL_ENABLED) return "You'll approve an outline before any writing starts.";
    const yours = n === 1 ? 'your paper' : `your ${n} papers`;
    if (sources === 'papers') return `GLKB reads ${yours} in full and writes the review from them, every claim cited. Nothing runs until you start it.`;
    if (sources === 'papers_and_search') return `GLKB finds the evidence, reads it with ${yours} and writes the review, every claim cited. Nothing runs until you start it.`;
    return 'GLKB finds the evidence, outlines the review and writes it, every claim cited. Nothing runs until you start it.';
};
/** The start button: what it starts. */
const startLabel = () => (LR_OUTLINE_APPROVAL_ENABLED ? 'Generate outline →' : 'Start writing →');

/** The bottom bar's second line: what the review reads, and how long it takes. */
const phoneSource = (sources, n) => {
    const yours = n === 1 ? 'your paper' : `your ${n} papers`;
    const time = (span) => (LR_OUTLINE_APPROVAL_ENABLED ? `${span} in all` : `draft in ${span}`);
    if (sources === 'papers') return `From ${yours} · ${time('2–5 min')}`;
    if (sources === 'papers_and_search') return `${yours[0].toUpperCase()}${yours.slice(1)} + 33M abstracts · ${time('8–12 min')}`;
    return `From 33M abstracts · ${time('8–12 min')}`;
};

export default function ScopeStep({
    topic, onTopic, scope, onScope, serviceTier, onServiceTier, onResolveTier, onStart, canStart, error,
    papers, sources = 'search', phone = false,
}) {
    const now = new Date().getFullYear();
    const words = scope.targetWords || 6000;
    // What this review costs at the model picked (GET /credits/pricing): GPT-6 Luna 10, GPT-6.1 Terra 20, GPT-6.1 Sol 50.
    const [pricing, setPricing] = useState(null);
    useEffect(() => {
        let alive = true;
        fetchTierPricing().then((p) => { if (alive) setPricing(p); });
        return () => { alive = false; };
    }, []);
    const cost = creditsFor(pricing, serviceTier, 'literature_review');
    const costText = cost === null ? '' : `${cost.toLocaleString('en-US')} credit${cost === 1 ? '' : 's'}`;
    const fileRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const paperCount = papers?.readyAttachments?.length || 0;
    const blocked = papers ? attachmentBlockedNote(papers, { review: true, maxFiles: REVIEW_PAPER_LIMITS.maxFiles }) : '';
    // A review of a few papers has little to say at length: suggest a length they can carry.
    // Measured 2026-10-11 (Luna): three papers asked for 1,500 words gave 705.
    const carried = Math.max(800, Math.round((paperCount * 300) / 100) * 100);
    const fewPapers = sources === 'papers' && paperCount > 0 && words > carried;
    const papersOnly = sources === 'papers';
    // A source that reads papers, chosen before there are any: keep the choice and pick the files.
    const upload = papers ? (id) => { onScope({ ...scope, sources: id }); fileRef.current?.click(); } : undefined;
    // Article types to Model: the same rows on a wide screen and a phone.
    const restRows = (
        <>
        <div><dt>Article types</dt><dd>
            <OptionSelect label={`Article types: ${ARTICLE_TYPES.find((t) => t.id === (scope.articleTypes || 'all'))?.label}`}
                          panelLabel="Article types" value={scope.articleTypes || 'all'} options={ARTICLE_TYPES}
                          disabled={papersOnly} title={papersOnly ? SEARCH_ONLY_FILTER : undefined}
                          onChange={(id) => onScope({ ...scope, articleTypes: id })} />
        </dd></div>
        <div><dt>Citation style</dt><dd>
            <OptionSelect label={`Citation style: ${styleById(scope.citationStyle).label}`}
                          panelLabel="Citation style" value={styleById(scope.citationStyle).id}
                          options={REVIEW_STYLES.map((st) => ({
                              id: st.id, label: st.label,
                              hint: st.authorDate ? 'Author–year in the text' : 'Numbered in the text',
                          }))}
                          onChange={(id) => onScope({ ...scope, citationStyle: id })} />
        </dd></div>
        <div><dt>Sources</dt><dd>
            <OptionSelect label={`Sources: ${sourceById(sources).label}`} panelLabel="Sources"
                          panelClassName="review-scope-panel is-sources"
                          value={sources} options={sourceOptions(paperCount, upload)}
                          onChange={(id) => onScope({ ...scope, ...sourcesPatch(id, paperCount) })} />
        </dd></div>
        <div><dt>Your papers</dt><dd>
            {papers ? (
                <>
                    <button type="button" className="lr-link lr-add-papers"
                            title={`Add your own papers: ${PAPER_FORMATS_TEXT}`}
                            onClick={() => fileRef.current?.click()}>
                        {paperCount ? `${paperCount} · Add more` : '+ Add papers'}
                    </button>
                    <input ref={fileRef} type="file" multiple hidden accept={PAPER_ACCEPT}
                           data-testid="lr-papers-input" aria-label="Add your papers"
                           onChange={(e) => {
                               const files = Array.from(e.target.files || []);
                               e.target.value = '';
                               if (files.length) papers.addFiles(files);
                           }} />
                </>
            ) : <span className="is-fixed">None</span>}
        </dd></div>
        {papers && (papers.hasItems || papers.notice) && (
            <div className="lr-scope-papers">
                <AttachmentChips items={papers.items} notice={papers.notice} blockedNote={blocked}
                                 onRemove={papers.remove} />
            </div>
        )}
        <div><dt>Email me when ready</dt><dd>
            <Switch size="small" checked={scope.notify !== false}
                    onChange={(e) => onScope({ ...scope, notify: e.target.checked })}
                    inputProps={{ 'aria-label': 'Email me when ready' }} />
        </dd></div>
        <div><dt>Model</dt><dd className="lr-scope-tier">
            <TierPicker
                value={serviceTier}
                onChange={onServiceTier}
                onResolveDefault={onResolveTier}
                pipeline="literature_review"
            />
        </dd></div>
        </>
    );
    const dropHandlers = {
        onDragOver: (e) => { if (papers && dragHasFiles(e)) { e.preventDefault(); setDragOver(true); } },
        onDragLeave: () => setDragOver(false),
        onDrop: (e) => {
            if (!papers || !dragHasFiles(e)) return;
            e.preventDefault();
            setDragOver(false);
            papers.addFiles(filesFromTransfer(e.dataTransfer));
        },
    };
    const fewPapersHint = fewPapers && (
        <p className="lr-scope-hint">
            {paperCount === 1 ? 'One paper carries' : `${paperCount} papers carry`} about{' '}
            {carried.toLocaleString('en-US')} words; the review will come out shorter than planned.
        </p>
    );

    if (phone) {
        /* The phone design ("Set up your review"): the topic, the length as four cards and the years
           as presets in one card, the other rows under them, and the start in a bar at the bottom. */
        const yearPresets = [null, now - 5, now - 10, now - 20];
        const onPresetYears = !scope.cutoffYear && yearPresets.includes(scope.startYear || null);
        const customWords = !PHONE_LENGTHS.some((l) => l.words === words);
        return (
            <div className="lr-mscope">
                <h1 className="lr-mscope-title">Set up your review</h1>
                <p className="lr-mscope-sub">{phoneLede(sources, paperCount)}</p>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <section className={`lr-mcard${dragOver ? ' is-drop-target' : ''}`} aria-label="Scope" {...dropHandlers}>
                    <div className="lr-mfield">
                        <label className="lr-mfield-label" htmlFor="lr-topic">Topic</label>
                        <p className="lr-mfield-hint">A question works better than a keyword.</p>
                        <textarea
                            id="lr-topic"
                            className="lr-mtopic"
                            aria-label="Topic"
                            rows={3}
                            value={topic}
                            onChange={(e) => onTopic(e.target.value)}
                            placeholder="e.g. Does p53 loss cause chemotherapy resistance across cancers?"
                        />
                    </div>
                    <div className="lr-mfield">
                        <div className="lr-mfield-label" id="lr-length-label">Target length</div>
                        <p className="lr-mfield-hint">Main text, excluding references.</p>
                        <div className="lr-mlengths" role="radiogroup" aria-labelledby="lr-length-label">
                            {PHONE_LENGTHS.map((l) => (
                                <button key={l.words} type="button" role="radio" aria-checked={words === l.words}
                                        className={`lr-mlength${words === l.words ? ' is-on' : ''}`}
                                        onClick={() => onScope({ ...scope, targetWords: l.words })}>
                                    <span className="lr-mlength-n">~{l.words.toLocaleString('en-US')}</span>
                                    <span className="lr-mlength-label">{l.label}</span>
                                </button>
                            ))}
                        </div>
                        <OptionDropdown label={`Custom length${customWords ? `: ${words.toLocaleString('en-US')} words` : ''}`}
                                        panelLabel="Target length" panelClassName="review-scope-panel is-length"
                                        className={`lr-mcustom${customWords ? ' is-on' : ''}`} placement="bottom-start"
                                        display={customWords ? `Custom: ${words.toLocaleString('en-US')} words` : 'Custom length'}>
                            {(close) => (
                                <div className="option-menu-footer">
                                    <CustomLength key={words} value={words}
                                                  onSet={(n) => { onScope({ ...scope, targetWords: n }); close(); }} />
                                </div>
                            )}
                        </OptionDropdown>
                    </div>
                    <div className="lr-mfield">
                        <div className="lr-mfield-label" id="lr-years-label">Publication years</div>
                        {papersOnly && <p className="lr-mfield-hint">{SEARCH_ONLY_FILTER}</p>}
                        <div className="lr-mchips" role="radiogroup" aria-labelledby="lr-years-label">
                            {yearPresets.map((y) => {
                                const on = onPresetYears && (scope.startYear || null) === y;
                                return (
                                    <button key={y ?? 'any'} type="button" role="radio" aria-checked={on} disabled={papersOnly}
                                            className={`lr-mchip${on ? ' is-on' : ''}`}
                                            onClick={() => onScope({ ...scope, startYear: y, cutoffYear: null })}>
                                        {y ? `${y}–${now}` : 'Any year'}
                                    </button>
                                );
                            })}
                            <OptionDropdown label={`Years: ${yearsLabel(scope, now, { long: true })}`} panelLabel="Years"
                                            panelClassName="review-scope-panel is-years" placement="bottom-start"
                                            className={`lr-mchip${onPresetYears ? '' : ' is-on'}`} disabled={papersOnly}
                                            display={onPresetYears ? 'Custom' : yearsLabel(scope, now, { long: true })}>
                                {() => (
                                    <YearRange startYear={scope.startYear} cutoffYear={scope.cutoffYear} now={now}
                                               onChange={(patch) => onScope({ ...scope, ...patch })} />
                                )}
                            </OptionDropdown>
                        </div>
                    </div>
                    <dl className="lr-scope-rows lr-mrows">{restRows}</dl>
                    {fewPapersHint}
                </section>
                <p className="lr-note">
                    {LR_OUTLINE_APPROVAL_ENABLED ? 'You can leave once it starts: the outline waits for you in Recent.'
                        : 'You can leave once it starts — the draft appears in Recent.'}
                </p>
                <div className="lr-mbar">
                    <div className="lr-mbar-text">
                        <div className="lr-mbar-big"><strong>~{words.toLocaleString('en-US')}</strong> words</div>
                        <div className="lr-mbar-sub">
                            {costText && <strong className="lr-mbar-cost">{costText}</strong>}
                            {costText && ' · '}
                            {phoneSource(sources, paperCount)}
                        </div>
                    </div>
                    <button type="button" className="lr-primary lr-mbar-go" disabled={!canStart} onClick={onStart}>
                        {startLabel()}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-page lr-scope">
            <div className="lr-main">
                <div className="lr-kicker">Step 1 · Define the scope<BetaBadge className="lr-kicker-beta" /></div>
                <label className="lr-topic-label" htmlFor="lr-topic">Topic</label>
                <textarea
                    id="lr-topic"
                    className="lr-topic"
                    aria-label="Topic"
                    rows={3}
                    value={topic}
                    onChange={(e) => onTopic(e.target.value)}
                    placeholder="e.g. Mechanisms of osimertinib resistance in EGFR-mutant lung cancer"
                />
                <p className="lr-lede">{lede(sources, paperCount)}</p>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </div>
            <aside
                className={`lr-card lr-scope-card${dragOver ? ' is-drop-target' : ''}`}
                aria-label="Scope"
                {...dropHandlers}
            >
                <div className="lr-card-title">Scope</div>
                <dl className="lr-scope-rows">
                    <div><dt>Target length</dt><dd>
                        <OptionDropdown label={`Target length: ${words.toLocaleString('en-US')} words`}
                                        panelLabel="Target length" panelClassName="review-scope-panel is-length"
                                        display={`${words.toLocaleString('en-US')} words`}>
                            {(close) => (
                                <LengthOptions words={words}
                                               onPick={(n) => { onScope({ ...scope, targetWords: n }); close(); }} />
                            )}
                        </OptionDropdown>
                    </dd></div>
                    <div><dt>Years</dt><dd>
                        <OptionDropdown label={`Years: ${yearsLabel(scope, now, { long: true })}`} panelLabel="Years"
                                        panelClassName="review-scope-panel is-years"
                                        display={yearsLabel(scope, now, { long: true })}
                                        disabled={papersOnly} title={papersOnly ? SEARCH_ONLY_FILTER : undefined}>
                            {() => (
                                <YearRange startYear={scope.startYear} cutoffYear={scope.cutoffYear} now={now}
                                           onChange={(patch) => onScope({ ...scope, ...patch })} />
                            )}
                        </OptionDropdown>
                    </dd></div>
                    {restRows}
                </dl>
                <div className="lr-planned">
                    <span>Planned length</span>
                    <span className="lr-mono">~{words.toLocaleString('en-US')} words · ~{Math.max(6, Math.round(words / 600))} sections</span>
                </div>
                {costText && (
                    <div className="lr-planned lr-cost">
                        <span>Cost</span>
                        <span className="lr-mono">{costText}</span>
                    </div>
                )}
                {fewPapersHint}
                <button type="button" className="lr-primary" disabled={!canStart} onClick={onStart}>
                    {startLabel()}
                </button>
                <p className="lr-note">
                    {LR_OUTLINE_APPROVAL_ENABLED ? (
                        <>
                            {sources === 'papers' ? '2–5 min' : '8–12 min'} in all, with a stop for you to approve the
                            outline. You can leave: it waits for you in Recent.
                        </>
                    ) : (
                        <>{sources === 'papers' ? 'Takes 2–5 min.' : 'Takes 8–12 min.'} You can leave — the draft appears in Recent.</>
                    )}
                </p>
            </aside>
        </div>
    );
}
