import React, { useMemo } from 'react';
import { message } from 'antd';
import { Dialog } from '@mui/material';
import closeIcon from './close.svg';
import copyIcon from './copy.svg';
import { FORMATS, normalizeCitation, generateCitation, generateBibTeX, generateEndNote } from './format';
import './scoped.css';

const CiteDialog = ({ open, onClose, citation }) => {
    const paper = useMemo(() => normalizeCitation(citation), [citation]);
    const copy = async (format) => {
        const text = format === 'BibTeX' ? generateBibTeX(paper)
            : format === 'EndNote' ? generateEndNote(paper) : generateCitation(format, paper);
        try {
            await navigator.clipboard.writeText(text);
            message.success(`${format} citation copied to clipboard`);
        } catch {
            message.error('Copy failed');
        }
    };
    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="cite-paper-title"
            maxWidth={false} PaperProps={{ className: 'cite-paper-dialog' }}>
            <div className="cite-paper-header">
                <h2 id="cite-paper-title">Cite this paper</h2>
                <button type="button" className="cite-paper-close" aria-label="Close citation dialog" onClick={onClose}>
                    <img src={closeIcon} alt="" />
                </button>
            </div>
            <hr />
            {FORMATS.map((format) => (
                <section className="cite-paper-format" key={format} aria-label={format}>
                    <h3>{format}</h3>
                    <div className="cite-paper-text">
                        <p>{generateCitation(format, paper)}</p>
                        <button type="button" className="cite-paper-copy" aria-label={`Copy ${format} citation`} onClick={() => copy(format)}>
                            <img src={copyIcon} alt="" />
                        </button>
                    </div>
                </section>
            ))}
            <hr />
            <div className="cite-paper-footer">
                <span>Copy as</span>
                <div className="cite-paper-exports">
                    {['BibTeX', 'EndNote'].map((format) => (
                        <button type="button" key={format} onClick={() => copy(format)}>{format}</button>
                    ))}
                </div>
            </div>
        </Dialog>
    );
};
export default CiteDialog;
