import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import '../LLMAgent/github-markdown-light.css';
import AnswerGraph from '.';
import { graphFromRows, sparsify } from './answerGraph';
import fixture from './demoFixture.json';

/* The four frames the design draws the graph at, plus the column's own width. */
const WIDTHS = [['Auto', null], ['336', 336], ['464', 464], ['664', 664], ['944', 944]];

/**
 * /demo/answer-graph — a real answer (gpt-6-luna, captured 2026-10-10) with its knowledge
 * graph drawn in the text, from the rows GLKB returned for that answer's kg_query_list.
 * A review page for the design; nothing links to it.
 */
export default function AnswerGraphDemo() {
    const [width, setWidth] = useState(null);
    const graph = useMemo(() => sparsify(graphFromRows(fixture.rows)), []);
    const [intro, ...rest] = fixture.answer.split(/\n\n/);
    const md = (text) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;

    return (
        <div style={{ minHeight: '100%', background: 'var(--color-background-page, #F7F9FC)', padding: '24px 16px 64px' }}>
            <div style={{ maxWidth: width ? Math.max(width, 680) : 760, margin: '0 auto' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                    Graph width:
                    {WIDTHS.map(([label, value]) => (
                        <button
                            key={label} type="button" onClick={() => setWidth(value)}
                            style={{
                                padding: '4px 10px', borderRadius: 8, cursor: 'pointer', font: 'inherit',
                                border: '1px solid var(--color-border-default)',
                                background: width === value ? 'var(--color-brand-soft)' : 'var(--color-background-surface)',
                                color: width === value ? 'var(--color-brand-primary)' : 'inherit',
                            }}
                        >{label}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <div style={{ maxWidth: 460, padding: '12px 16px', borderRadius: 12, background: 'var(--color-background-muted)', fontSize: 15, lineHeight: '24px' }}>
                        {fixture.question}
                    </div>
                </div>
                <div className="markdown-body" style={{ background: 'transparent', fontSize: 15, lineHeight: '24px' }}>
                    {md(intro)}
                    <div style={{ width: width || '100%', maxWidth: '100%' }}>
                        <AnswerGraph graph={graph} caption="Entities this answer is about, and how GLKB connects them. Click a node or a line for details." />
                    </div>
                    {md(rest.join('\n\n'))}
                </div>
            </div>
        </div>
    );
}
