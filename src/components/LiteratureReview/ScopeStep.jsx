import React, { useRef, useState } from 'react';
import { Alert, MenuItem, Select, Switch } from '@mui/material';

import {
    ARTICLE_TYPES, clampWords, CustomLength, LENGTH_OPTIONS, SOURCES, sourceById, yearOptions,
} from '../HomePage/ReviewScope';
import TierPicker from '../Units/TierPicker';
import { AttachmentChips, attachmentBlockedNote, dragHasFiles, filesFromTransfer } from '../Units/AttachmentChips';
import { PAPER_ACCEPT, PAPER_FORMATS_TEXT, REVIEW_PAPER_LIMITS } from '../../service/attachments';
import { REVIEW_STYLES, styleById } from './citationStyle';

const CUSTOM = 'custom';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: the outline
 * page's "Scope" card). Length, the end year and the article types reach the pipeline; the
 * citation style is the page's own (it can be changed on the finished review too); the model is
 * picked with the chat's own picker, as a service tier. The reader's own papers are added here
 * (or dropped on the card), and Sources says how they are used: with the search, or alone.
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
    papers, sources = 'search', onSources,
}) {
    const now = new Date().getFullYear();
    const words = scope.targetWords || 6000;
    const [customOpen, setCustomOpen] = useState(!LENGTH_OPTIONS.includes(words));
    const fileRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const paperCount = papers?.readyAttachments?.length || 0;
    const blocked = papers ? attachmentBlockedNote(papers, { review: true, maxFiles: REVIEW_PAPER_LIMITS.maxFiles }) : '';
    // A review of a few papers has little to say at length: suggest a length they can carry.
    // Measured 2026-10-11 (Luna): three papers asked for 1,500 words gave 705.
    const carried = Math.max(800, Math.round((paperCount * 300) / 100) * 100);
    const fewPapers = sources === 'papers' && paperCount > 0 && words > carried;
    return (
        <div className="lr-page lr-scope">
            <div className="lr-main">
                <div className="lr-kicker">Step 1 · Define the scope</div>
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
                        <Select size="small" variant="standard" disableUnderline
                                value={customOpen ? CUSTOM : words}
                                onChange={(e) => {
                                    if (e.target.value === CUSTOM) { setCustomOpen(true); return; }
                                    setCustomOpen(false);
                                    onScope({ ...scope, targetWords: e.target.value });
                                }}
                                renderValue={(v) => (v === CUSTOM ? `${words.toLocaleString('en-US')} words` : `${Number(v).toLocaleString('en-US')} words`)}
                                inputProps={{ 'aria-label': 'Target length' }}>
                            {LENGTH_OPTIONS.map((n) => <MenuItem key={n} value={n}>{n.toLocaleString('en-US')} words</MenuItem>)}
                            <MenuItem value={CUSTOM}>Custom length…</MenuItem>
                        </Select>
                    </dd></div>
                    {customOpen && (
                        <div className="lr-scope-custom">
                            <CustomLength key={words} value={words}
                                          onSet={(n) => onScope({ ...scope, targetWords: clampWords(n) })} />
                        </div>
                    )}
                    <div><dt>Years</dt><dd>
                        <Select size="small" variant="standard" disableUnderline value={scope.cutoffYear || now}
                                onChange={(e) => onScope({ ...scope, cutoffYear: e.target.value === now ? null : e.target.value })}
                                inputProps={{ 'aria-label': 'Years' }}>
                            {yearOptions(now).map((y) => <MenuItem key={y} value={y}>Up to {y}</MenuItem>)}
                        </Select>
                    </dd></div>
                    <div><dt>Article types</dt><dd>
                        <Select size="small" variant="standard" disableUnderline value={scope.articleTypes || 'all'}
                                disabled={sources === 'papers'}
                                title={sources === 'papers' ? 'Applies to what GLKB searches; your papers are all used' : undefined}
                                onChange={(e) => onScope({ ...scope, articleTypes: e.target.value })}
                                inputProps={{ 'aria-label': 'Article types' }}>
                            {ARTICLE_TYPES.map((t) => <MenuItem key={t.id} value={t.id} title={t.hint}>{t.label}</MenuItem>)}
                        </Select>
                    </dd></div>
                    <div><dt>Citation style</dt><dd>
                        <Select size="small" variant="standard" disableUnderline value={styleById(scope.citationStyle).id}
                                onChange={(e) => onScope({ ...scope, citationStyle: e.target.value })}
                                inputProps={{ 'aria-label': 'Citation style' }}>
                            {REVIEW_STYLES.map((st) => <MenuItem key={st.id} value={st.id}>{st.label}</MenuItem>)}
                        </Select>
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
                    <div><dt>Sources</dt><dd>
                        <Select size="small" variant="standard" disableUnderline value={sources}
                                disabled={!paperCount}
                                title={paperCount ? sourceById(sources).hint : 'Add your papers to choose'}
                                onChange={(e) => onSources?.(e.target.value)}
                                inputProps={{ 'aria-label': 'Sources' }}>
                            {SOURCES.map((x) => <MenuItem key={x.id} value={x.id} title={x.hint}>{x.label}</MenuItem>)}
                        </Select>
                    </dd></div>
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
