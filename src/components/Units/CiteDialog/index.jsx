import React, { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { Dialog } from '@mui/material';
import closeIcon from './close.svg';
import copyIcon from './copy.svg';
import { fetchCitation, fetchRis } from '../../../service/Citation';
import { EXPORTS, FORMATS, cslFromCard, formatCitation, normalizeCsl, toBibTeX, toEndNote } from './format';
import './scoped.css';

/**
 * "Cite this paper". `citation` is a reference card's `[title, url, citation_count, year,
 * journal, authors]` array; the PMID in its URL is what the dialog is really about. The
 * styles render from NCBI's record for that PMID (volume, issue, pages, DOI, authors split
 * into family/given), fetched when the dialog opens. Until it arrives — or if it never does —
 * the card's own fields render as a partial citation, and the dialog says so.
 */
const CiteDialog = ({ open, onClose, citation }) => {
    const fallback = useMemo(() => cslFromCard(citation), [citation]);
    const pmid = fallback.PMID || '';
    const [record, setRecord] = useState(null);
    const [status, setStatus] = useState('idle'); // idle | loading | ready | partial

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        setRecord(null);
        if (!pmid) {
            setStatus('partial');
            return undefined;
        }
        setStatus('loading');
        fetchCitation(pmid).then((csl) => {
            if (cancelled) return;
            setRecord(csl);
            setStatus(csl ? 'ready' : 'partial');
        });
        return () => { cancelled = true; };
    }, [open, pmid]);

    const paper = record || fallback;
    const texts = useMemo(
        () => Object.fromEntries(FORMATS.map((format) => [format, formatCitation(format, paper)])),
        [paper],
    );

    const copyText = async (label, text) => {
        if (!text) {
            message.error(`No ${label} citation available for this paper`);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            message.success(`${label} citation copied to clipboard`);
        } catch {
            message.error('Copy failed');
        }
    };

    const copyExport = async (format) => {
        if (format === 'BibTeX') return copyText(format, toBibTeX(paper));
        if (format === 'EndNote') return copyText(format, toEndNote(paper));
        // RIS comes from NCBI verbatim; without a record there is nothing faithful to copy.
        const ris = pmid ? await fetchRis(pmid) : null;
        return copyText(format, ris || '');
    };

    const { title } = normalizeCsl(paper);
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
            {status === 'loading' && (
                <p className="cite-paper-note" role="status">Fetching the PubMed record{title ? ` for “${title}”` : ''}…</p>
            )}
            {status === 'partial' && (
                <p className="cite-paper-note" role="status">
                    The PubMed record could not be fetched, so these citations are built from the
                    reference card alone and omit volume, pages and DOI.
                </p>
            )}
            {FORMATS.map((format) => (
                <section className="cite-paper-format" key={format} aria-label={format}>
                    <h3>{format}</h3>
                    <div className="cite-paper-text">
                        <p>{texts[format]}</p>
                        <button type="button" className="cite-paper-copy" aria-label={`Copy ${format} citation`}
                            onClick={() => copyText(format, texts[format])}>
                            <img src={copyIcon} alt="" />
                        </button>
                    </div>
                </section>
            ))}
            <hr />
            <div className="cite-paper-footer">
                <span>Copy as</span>
                <div className="cite-paper-exports">
                    {EXPORTS.map((format) => (
                        <button type="button" key={format} onClick={() => copyExport(format)}>{format}</button>
                    ))}
                </div>
            </div>
        </Dialog>
    );
};
export default CiteDialog;
