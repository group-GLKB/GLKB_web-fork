import React, { useEffect, useRef, useState } from 'react';
import { Alert, Switch } from '@mui/material';

import {
    ARTICLE_TYPES, CustomLength, MAX_WORDS, MIN_WORDS, NEEDS_PAPERS, SEARCH_ONLY_FILTER, SOURCES, sourceById, sourceOptions,
    sourcesPatch, usesPapers, YearRange, yearsLabel,
} from '../HomePage/ReviewScope';
import BetaBadge from '../Units/BetaBadge';
import TierPicker from '../Units/TierPicker';
import { OptionDropdown, OptionSelect } from '../Units/OptionMenu';
import { AttachmentChips, attachmentBlockedNote, dragHasFiles, filesFromTransfer } from '../Units/AttachmentChips';
import { MAX_FILE_BYTES, PAPER_ACCEPT, PAPER_FORMATS_TEXT, REVIEW_PAPER_LIMITS } from '../../service/attachments';
import { attachmentMetaText } from '../../utils/attachmentList';
import useTierChoice from '../Units/TierPicker/useTierChoice';
import { trackGtagEvent } from '../../utils/gtag';
import { REVIEW_STYLES, styleById } from './citationStyle';
import { LR_OUTLINE_APPROVAL_ENABLED } from '../../config/features';
import { creditsFor, fetchTierPricing } from '../../service/serviceTiers';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: "Set up your review").
 * On a wide screen, the design's card of rows — topic, length, years, article types, sources, citation
 * style, the reader's papers, the mail, the model — each a set of chips, and beside it the planned
 * review with the start. Length, the years and the article types reach the pipeline; the citation
 * style is the page's own (it can be changed on the finished review too); the model is a service tier,
 * as the chat's. Sources says where the literature comes from — GLKB's search, the reader's own papers,
 * or both — and the papers are added here (or dropped on the card).
 *
 * Not from the design, because nothing behind it exists: the species and disease filters (the review
 * service has neither) and the "matching literature" count (nothing counts candidates before a run).
 * The article types are the service's three, one at a time, not the design's five to combine.
 * A phone keeps its own design (PHONE_LENGTHS, the rows under the cards).
 */

/** What the review reads, in a sentence, for the sources chosen (the Sources row's hint). */
const sourcesHint = (sources, n) => {
    const yours = `your ${n === 1 ? 'paper' : `${n} papers`}`;
    if (sources === 'papers') return `GLKB reviews ${yours} alone, reading each one in full.`;
    if (sources === 'papers_and_search') {
        return `GLKB searches PubMed and its knowledge graph and reads the evidence together with ${yours}.`;
    }
    return 'GLKB searches PubMed and its knowledge graph. Add your own papers to review them too, or only them.';
};

/** The design's length cards on a wide screen. The review service plans up to MAX_WORDS (12,000), so the
 *  design's 15,000-word "Extended" is 12,000 here. */
export const DESIGN_LENGTHS = [
    { words: 3000, label: 'Short' },
    { words: 6000, label: 'Standard' },
    { words: 10000, label: 'Comprehensive' },
    { words: 12000, label: 'Extended' },
];
/** About how many references a review of `words` cites: ~100 at 6,000 words (three reviews, 83–132,
 *  OutlineStep's WORDS_PER_CITATION), to the nearest ten. */
export const refsFor = (words) => Math.max(10, Math.round(words / 60 / 10) * 10);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const extOf = (name) => {
    const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || ''));
    return m ? m[1].toUpperCase() : 'FILE';
};

/** One row of the scope card: its name and hint on the left, its choices on the right. */
function Row({ label, hint, id, children }) {
    return (
        <div className="lr-drow">
            <div className="lr-drow-label">
                <div className="lr-drow-name" id={id}>{label}</div>
                {hint && <div className="lr-drow-hint">{hint}</div>}
            </div>
            <div className="lr-drow-ctl">{children}</div>
        </div>
    );
}

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
    // The model, as the design's cards (the chat's tiers, with what a review costs at each).
    const {
        tiers, defaultTier, selected: selectedTier, selectedRow: tierRow, clearResolved,
    } = useTierChoice({ value: serviceTier, pipeline: 'literature_review', onResolveDefault: onResolveTier });
    const pickTier = (id) => {
        if (id === selectedTier) return;
        trackGtagEvent('chat_tier_select', { source: 'literature_review_scope', tier: id, pipeline: 'literature_review' });
        clearResolved();
        onServiceTier(id);
    };
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

    /* A wide screen: the design's "Set up your review" — a card of rows (the label and its hint on the
       left, the choices as chips on the right) and, beside it, what the review will be with the start. */
    const refs = refsFor(words);
    const presetWords = DESIGN_LENGTHS.some((l) => l.words === words);
    const yearPresets = [null, now - 5, now - 10, 2000];
    const onPresetYears = !scope.cutoffYear && yearPresets.includes(scope.startYear || null);
    const type = ARTICLE_TYPES.find((t) => t.id === (scope.articleTypes || 'all')) || ARTICLE_TYPES[0];
    const style = styleById(scope.citationStyle);
    const pickSource = (id) => {
        if (usesPapers(id) && !paperCount && papers) { upload(id); return; }
        onScope({ ...scope, ...sourcesPatch(id, paperCount) });
    };
    const wantsPapers = usesPapers(scope.sources) && !paperCount;
    const summary = [
        ['Target length', `${fmt(words)} words`],
        ['References', `~${fmt(refs)}`],
        ...(papersOnly ? [] : [['Years', yearsLabel(scope, now, { long: true })], ['Article types', type.label]]),
        ['Sources', sourceById(sources).label],
        ['Your papers', paperCount ? `${paperCount} file${paperCount === 1 ? '' : 's'}` : 'None'],
        ['Citation style', style.label],
        ...(tierRow ? [['Model', tierRow.label]] : []),
        ...(costText ? [['Cost', costText]] : []),
    ];
    return (
        <div className="lr-dpage lr-scope-page">
            <div className="lr-dmain">
                <div className="lr-dkicker">Step 1 · Define the scope<BetaBadge className="lr-kicker-beta" /></div>
                <h1 className="lr-dtitle">Set up your review</h1>
                <p className="lr-dlede">
                    Tell GLKB what to cover.{' '}
                    {LR_OUTLINE_APPROVAL_ENABLED ? "You'll approve an outline before any writing starts." : 'Nothing runs until you start it.'}
                </p>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <section className={`lr-dcard${dragOver ? ' is-drop-target' : ''}`} aria-label="Scope" {...dropHandlers}>
                    <Row label={<label htmlFor="lr-topic">Topic</label>} hint="A question works better than a keyword.">
                        <textarea
                            id="lr-topic"
                            className="lr-dtopic"
                            aria-label="Topic"
                            rows={2}
                            value={topic}
                            onChange={(e) => onTopic(e.target.value)}
                            placeholder="e.g. Does p53 loss cause chemotherapy resistance across cancers?"
                        />
                    </Row>
                    <Row label="Target length" hint="Main text, excluding references." id="lr-dlength">
                        <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dlength">
                            {DESIGN_LENGTHS.map((l) => (
                                <button key={l.words} type="button" role="radio" aria-checked={words === l.words}
                                        className={`lr-dlen${words === l.words ? ' is-on' : ''}`}
                                        onClick={() => onScope({ ...scope, targetWords: l.words })}>
                                    <span className="lr-dlen-n">{fmt(l.words)}</span>
                                    <span className="lr-dlen-sub">{l.label} · ~{refsFor(l.words)} refs</span>
                                </button>
                            ))}
                            <OptionDropdown label={`Custom length${presetWords ? '' : `: ${fmt(words)} words`}`}
                                            panelLabel="Target length" panelClassName="review-scope-panel is-length lr-pop"
                                            className={`lr-dlen is-custom${presetWords ? '' : ' is-on'}`} placement="bottom-start"
                                            display={(
                                                <>
                                                    <span className="lr-dlen-n">{presetWords ? 'Custom' : fmt(words)}</span>
                                                    <span className="lr-dlen-sub">
                                                        {presetWords ? `${fmt(MIN_WORDS)}–${fmt(MAX_WORDS)} words` : `Custom · ~${refs} refs`}
                                                    </span>
                                                </>
                                            )}>
                                {(close) => (
                                    <div className="option-menu-footer">
                                        <CustomLength key={words} value={words}
                                                      onSet={(n) => { onScope({ ...scope, targetWords: n }); close(); }} />
                                    </div>
                                )}
                            </OptionDropdown>
                        </div>
                    </Row>
                    <Row label="Publication years" hint={papersOnly ? SEARCH_ONLY_FILTER : ''} id="lr-dyears">
                        <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dyears">
                            {yearPresets.map((y) => {
                                const on = onPresetYears && (scope.startYear || null) === y;
                                const label = y === null ? 'Any year'
                                    : `${y}–${now} · ${y === 2000 ? 'Since 2000' : `Last ${now - y} years`}`;
                                return (
                                    <button key={y ?? 'any'} type="button" role="radio" aria-checked={on} disabled={papersOnly}
                                            className={`lr-dchip${on ? ' is-on' : ''}`}
                                            onClick={() => onScope({ ...scope, startYear: y, cutoffYear: null })}>
                                        {label}
                                    </button>
                                );
                            })}
                            <OptionDropdown label={`Years: ${yearsLabel(scope, now, { long: true })}`} panelLabel="Years"
                                            panelClassName="review-scope-panel is-years lr-pop" placement="bottom-start"
                                            className={`lr-dchip${onPresetYears ? '' : ' is-on'}`} disabled={papersOnly}
                                            display={onPresetYears ? 'Custom…' : yearsLabel(scope, now, { long: true })}>
                                {() => (
                                    <YearRange startYear={scope.startYear} cutoffYear={scope.cutoffYear} now={now}
                                               onChange={(patch) => onScope({ ...scope, ...patch })} />
                                )}
                            </OptionDropdown>
                        </div>
                    </Row>
                    <Row label="Article types" hint={papersOnly ? SEARCH_ONLY_FILTER : type.hint} id="lr-dtypes">
                        <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dtypes">
                            {ARTICLE_TYPES.map((t) => (
                                <button key={t.id} type="button" role="radio" aria-checked={type.id === t.id}
                                        disabled={papersOnly} title={t.hint}
                                        className={`lr-dchip${type.id === t.id ? ' is-on' : ''}`}
                                        onClick={() => onScope({ ...scope, articleTypes: t.id })}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </Row>
                    <Row label="Sources" hint={sourcesHint(sources, paperCount)} id="lr-dsources">
                        <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dsources">
                            {SOURCES.map((x) => (
                                <button key={x.id} type="button" role="radio" aria-checked={sources === x.id} title={x.hint}
                                        className={`lr-dchip${sources === x.id ? ' is-on' : ''}`}
                                        onClick={() => pickSource(x.id)}>
                                    {x.label}
                                </button>
                            ))}
                        </div>
                        {wantsPapers && <p className="lr-dnote" role="status">{NEEDS_PAPERS}</p>}
                    </Row>
                    <Row label="Citation style" hint={style.authorDate ? 'Author–year in the text' : 'Numbered in the text'} id="lr-dstyle">
                        <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dstyle">
                            {REVIEW_STYLES.map((st) => (
                                <button key={st.id} type="button" role="radio" aria-checked={style.id === st.id}
                                        className={`lr-dchip${style.id === st.id ? ' is-on' : ''}`}
                                        onClick={() => onScope({ ...scope, citationStyle: st.id })}>
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </Row>
                    <Row label="Your papers" hint="PDF, Word, LaTeX or text. Always considered, cited where relevant.">
                        {papers ? (
                            <div className="lr-dpapers">
                                <button type="button" className="lr-ddrop" title={`Add your own papers: ${PAPER_FORMATS_TEXT}`}
                                        onClick={() => fileRef.current?.click()}>
                                    <span className="lr-ddrop-main">Drop files or <span>browse</span></span>
                                    <span className="lr-ddrop-sub">
                                        Up to {REVIEW_PAPER_LIMITS.maxFiles} files · {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB each
                                    </span>
                                </button>
                                <input ref={fileRef} type="file" multiple hidden accept={PAPER_ACCEPT}
                                       data-testid="lr-papers-input" aria-label="Add your papers"
                                       onChange={(e) => {
                                           const files = Array.from(e.target.files || []);
                                           e.target.value = '';
                                           if (files.length) papers.addFiles(files);
                                       }} />
                                {papers.items.map((item) => (
                                    <div key={item.key} className={`lr-dfile is-${item.status}`}>
                                        <span className="lr-dfile-ext">{extOf(item.name)}</span>
                                        <span className="lr-dfile-text">
                                            <span className="lr-dfile-name" title={item.name}>{item.name}</span>
                                            <span className="lr-dfile-meta">
                                                {attachmentMetaText(item.attachment, { fallbackName: item.name, fallbackSize: item.size })}
                                            </span>
                                        </span>
                                        <span className="lr-dfile-state" role={item.status === 'error' ? 'alert' : undefined}>
                                            {item.status === 'uploading'
                                                ? `Uploading… ${Math.round((Number(item.progress) || 0) * 100)}%`
                                                : item.status === 'error' ? (item.error || 'Upload failed') : 'Parsed'}
                                        </span>
                                        <button type="button" className="lr-dfile-x" aria-label={`Remove ${item.name}`}
                                                onClick={() => papers.remove(item.key)}>×</button>
                                    </div>
                                ))}
                                {(papers.notice || blocked) && <p className="lr-dnote" role="status">{papers.notice || blocked}</p>}
                                {fewPapersHint}
                            </div>
                        ) : <span className="lr-dnote">None</span>}
                    </Row>
                    <Row label="Email me when ready"
                         hint={LR_OUTLINE_APPROVAL_ENABLED ? 'When the outline waits for you, and when the review is saved.' : 'When the review is saved.'}>
                        <button type="button" role="switch" aria-checked={scope.notify !== false} aria-label="Email me when ready"
                                className={`lr-dswitch${scope.notify !== false ? ' is-on' : ''}`}
                                onClick={() => onScope({ ...scope, notify: scope.notify === false })}>
                            <span />
                        </button>
                    </Row>
                    {tiers.length > 0 && (
                        <Row label="Model" hint="Charged once per review." id="lr-dmodel">
                            <div className="lr-dchips" role="radiogroup" aria-labelledby="lr-dmodel">
                                {tiers.map((t) => {
                                    const credits = t.credits?.literature_review;
                                    return (
                                        <button key={t.id} type="button" role="radio" aria-checked={selectedTier === t.id}
                                                className={`lr-dlen${selectedTier === t.id ? ' is-on' : ''}`}
                                                onClick={() => pickTier(t.id)}>
                                            <span className="lr-dlen-n">{t.label}</span>
                                            <span className="lr-dlen-sub">
                                                {[Number.isFinite(credits) ? `${credits} credit${credits === 1 ? '' : 's'}` : '',
                                                  t.id === defaultTier ? 'Default' : ''].filter(Boolean).join(' · ')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Row>
                    )}
                </section>
            </div>
            <aside className="lr-daside" aria-label="Your review">
                <div className="lr-daside-kicker">Planned review</div>
                <div className="lr-dbig">
                    <span className="lr-dbig-n">{fmt(words)}</span>
                    <span className="lr-dbig-unit">words</span>
                </div>
                <div className="lr-dbig-note">
                    About {fmt(refs)} references in ~{Math.max(6, Math.round(words / 600))} sections
                </div>
                <dl className="lr-dsummary">
                    {summary.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
                <button type="button" className="lr-btn-primary lr-daside-go" disabled={!canStart} onClick={onStart}>
                    {startLabel()}
                </button>
                <p className="lr-daside-note">
                    {LR_OUTLINE_APPROVAL_ENABLED
                        ? `The outline takes a few minutes${sources === 'papers' ? '' : ' (it searches first)'}. Nothing is written until you approve it.`
                        : `${sources === 'papers' ? 'Takes 2–5 min.' : 'Takes 8–12 min.'} You can leave — the draft appears in Recent.`}
                </p>
            </aside>
        </div>
    );
}
