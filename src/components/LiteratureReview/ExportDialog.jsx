import React, { useState } from 'react';
import { Dialog } from '@mui/material';

import { REVIEW_STYLES, styleById } from './citationStyle';

/**
 * "Export review" (the design's export dialog): the format as cards, the citation style it is written
 * in, and one button that downloads it. The formats are the ones the page can write itself
 * (utils/reviewToLatex, utils/reviewExport); the design's BibTeX, verification appendix and handling of
 * unverified citations have nothing behind them yet, so they are not offered.
 */
export const EXPORT_FORMATS = [
    { id: 'latex', label: 'LaTeX', ext: '.tex', sub: 'A .tex file to compile' },
    { id: 'word', label: 'Word', ext: '.doc', sub: 'To edit in Word or Google Docs' },
    { id: 'pdf', label: 'PDF', ext: '.pdf', sub: 'Saved from the print dialog' },
];

export default function ExportDialog({ open, onClose, summary, citationStyle, onCitationStyle, onExport }) {
    const [format, setFormat] = useState('latex');
    const chosen = EXPORT_FORMATS.find((f) => f.id === format) || EXPORT_FORMATS[0];
    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="lr-export-title"
                PaperProps={{ className: 'lr-export' }} BackdropProps={{ className: 'lr-export-backdrop' }}>
            <div className="lr-export-head">
                <div>
                    <div className="lr-export-title" id="lr-export-title">Export review</div>
                    {summary && <div className="lr-export-sub">{summary}</div>}
                </div>
                <button type="button" className="lr-export-x" aria-label="Close" onClick={onClose}>×</button>
            </div>
            <div className="lr-export-formats" role="radiogroup" aria-label="Format">
                {EXPORT_FORMATS.map((f) => (
                    <button key={f.id} type="button" role="radio" aria-checked={format === f.id}
                            className={`lr-export-format${format === f.id ? ' is-on' : ''}`} onClick={() => setFormat(f.id)}>
                        <span className="lr-export-format-top">
                            <span className="lr-export-ext">{f.ext}</span>
                            <span className="lr-export-format-label">{f.label}</span>
                        </span>
                        <span className="lr-export-format-sub">{f.sub}</span>
                    </button>
                ))}
            </div>
            {onCitationStyle && (
                <div className="lr-export-rows">
                    <div className="lr-export-row">
                        <span className="lr-export-row-label">Citation style</span>
                        <div className="lr-seg" role="radiogroup" aria-label="Citation style">
                            {REVIEW_STYLES.map((st) => (
                                <button key={st.id} type="button" role="radio" aria-checked={styleById(citationStyle).id === st.id}
                                        className={styleById(citationStyle).id === st.id ? 'is-on' : ''}
                                        onClick={() => onCitationStyle(st.id)}>
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="lr-export-foot">
                <button type="button" className="lr-btn-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="lr-btn-primary lr-export-go" onClick={() => { onClose(); onExport(format); }}>
                    Download {chosen.ext}
                </button>
            </div>
        </Dialog>
    );
}
