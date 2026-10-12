import React, { useRef, useState } from 'react';
import { Alert, Switch } from '@mui/material';

import {
    ARTICLE_TYPES, LengthOptions, SEARCH_ONLY_FILTER, sourceById, sourceOptions, sourcesPatch, YearRange, yearsLabel,
} from '../HomePage/ReviewScope';
import BetaBadge from '../Units/BetaBadge';
import TierPicker from '../Units/TierPicker';
import { OptionDropdown, OptionSelect } from '../Units/OptionMenu';
import { AttachmentChips, attachmentBlockedNote, dragHasFiles, filesFromTransfer } from '../Units/AttachmentChips';
import { PAPER_ACCEPT, PAPER_FORMATS_TEXT, REVIEW_PAPER_LIMITS } from '../../service/attachments';
import { REVIEW_STYLES, styleById } from './citationStyle';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: the outline
 * page's "Scope" card). Length, the years and the article types reach the pipeline; the
 * citation style is the page's own (it can be changed on the finished review too); the model is
 * picked with the chat's own picker, as a service tier. Sources says where the literature comes
 * from — GLKB's search, the reader's own papers, or both — and the papers are added here (or
 * dropped on the card). The dropdowns are the app's own (Units/OptionMenu), as the Model row's.
 */

/** What the review will do, in a sentence, for the sources chosen. */
const lede = (sources, n) => {
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

export default function ScopeStep({
    topic, onTopic, scope, onScope, serviceTier, onServiceTier, onResolveTier, onStart, canStart, error,
    papers, sources = 'search',
}) {
    const now = new Date().getFullYear();
    const words = scope.targetWords || 6000;
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
                onDragOver={(e) => { if (papers && dragHasFiles(e)) { e.preventDefault(); setDragOver(true); } }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    if (!papers || !dragHasFiles(e)) return;
                    e.preventDefault();
                    setDragOver(false);
                    papers.addFiles(filesFromTransfer(e.dataTransfer));
                }}
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
                </dl>
                <div className="lr-planned">
                    <span>Planned length</span>
                    <span className="lr-mono">~{words.toLocaleString('en-US')} words · ~{Math.max(6, Math.round(words / 600))} sections</span>
                </div>
                {fewPapers && (
                    <p className="lr-scope-hint">
                        {paperCount === 1 ? 'One paper carries' : `${paperCount} papers carry`} about{' '}
                        {carried.toLocaleString('en-US')} words; the review will come out shorter than planned.
                    </p>
                )}
                <button type="button" className="lr-primary" disabled={!canStart} onClick={onStart}>
                    Start writing →
                </button>
                <p className="lr-note">
                    {sources === 'papers' ? 'Takes 2–5 min.' : 'Takes 8–12 min.'} You can leave — the draft appears in Recent.
                </p>
            </aside>
        </div>
    );
}
