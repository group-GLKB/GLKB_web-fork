import React from 'react';
import { Alert, MenuItem, Select } from '@mui/material';

import { LENGTH_OPTIONS, yearOptions } from '../HomePage/ReviewScope';

/**
 * Step 1: the topic and its scope, confirmed before anything runs (design: the outline
 * page's "Scope" card). Length and the end year reach the pipeline; the rows it has nothing
 * for yet are stated rather than offered.
 */
export default function ScopeStep({
    topic, onTopic, scope, onScope, models, model, onModel, onStart, canStart, error,
}) {
    const now = new Date().getFullYear();
    const words = scope.targetWords || 6000;
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
                        <Select size="small" variant="standard" disableUnderline value={words}
                                onChange={(e) => onScope({ ...scope, targetWords: e.target.value })}
                                inputProps={{ 'aria-label': 'Target length' }}>
                            {LENGTH_OPTIONS.map((n) => <MenuItem key={n} value={n}>{n.toLocaleString('en-US')} words</MenuItem>)}
                        </Select>
                    </dd></div>
                    <div><dt>Years</dt><dd>
                        <Select size="small" variant="standard" disableUnderline value={scope.cutoffYear || now}
                                onChange={(e) => onScope({ ...scope, cutoffYear: e.target.value === now ? null : e.target.value })}
                                inputProps={{ 'aria-label': 'Years' }}>
                            {yearOptions(now).map((y) => <MenuItem key={y} value={y}>Up to {y}</MenuItem>)}
                        </Select>
                    </dd></div>
                    <div><dt>Article types</dt><dd className="is-fixed">All types</dd></div>
                    <div><dt>Citation style</dt><dd className="is-fixed">Vancouver</dd></div>
                    <div><dt>Your papers</dt><dd className="is-fixed">None</dd></div>
                    {models.length > 0 && (
                        <div><dt>Model</dt><dd>
                            <Select size="small" variant="standard" disableUnderline value={model}
                                    onChange={(e) => onModel(e.target.value)} inputProps={{ 'aria-label': 'Model' }}>
                                {models.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                            </Select>
                        </dd></div>
                    )}
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
