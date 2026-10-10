import React, { useState } from 'react';
import { Alert, MenuItem, Select, Switch } from '@mui/material';

import {
    ARTICLE_TYPES, clampWords, CustomLength, LENGTH_OPTIONS, yearOptions,
} from '../HomePage/ReviewScope';
import TierPicker from '../Units/TierPicker';
import { REVIEW_STYLES, styleById } from './citationStyle';

const CUSTOM = 'custom';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: the outline
 * page's "Scope" card). Length, the end year and the article types reach the pipeline; the
 * citation style is the page's own (it can be changed on the finished review too); the model is
 * picked with the chat's own picker, as a service tier. Your own papers are stated, not offered.
 */
export default function ScopeStep({
    topic, onTopic, scope, onScope, serviceTier, onServiceTier, onResolveTier, onStart, canStart, error,
}) {
    const now = new Date().getFullYear();
    const words = scope.targetWords || 6000;
    const [customOpen, setCustomOpen] = useState(!LENGTH_OPTIONS.includes(words));
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
                <p className="lr-lede">
                    GLKB searches PubMed and its knowledge graph, selects and synthesises the evidence,
                    outlines the review and writes it with every claim cited. Nothing runs until you start it.
                </p>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </div>
            <aside className="lr-card lr-scope-card" aria-label="Scope">
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
                    <div><dt>Your papers</dt><dd className="is-fixed">None</dd></div>
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
                <button type="button" className="lr-primary" disabled={!canStart} onClick={onStart}>
                    Start writing →
                </button>
                <p className="lr-note">Takes 8–12 min. You can leave — the draft appears in Recent.</p>
            </aside>
        </div>
    );
}
