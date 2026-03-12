import React, { useMemo } from 'react';

import { message } from 'antd';

import { Close as CloseIcon } from '@mui/icons-material';
import {
  Box,
  Button as MuiButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';

const FORMATS = ['MLA', 'APA', 'Chicago', 'Harvard', 'Vancouver'];

const normalizeCitation = (citation) => {
    if (!citation) {
        return {
            title: '',
            url: '',
            year: '',
            journal: '',
            authors: '',
            pubmedId: '',
        };
    }

    const title = citation[0] || '';
    const url = citation[1] || '';
    const year = citation[3] || '';
    const journal = citation[4] || '';
    const authors = Array.isArray(citation[5])
        ? citation[5].join(', ')
        : (citation[5] || '');
    const pubmedId = url
        ? url.split('/').filter(Boolean).pop()
        : '';

    return {
        title,
        url,
        year,
        journal,
        authors,
        pubmedId,
    };
};

const generateCitation = (format, citation) => {
    const {
        title,
        year,
        journal,
        authors,
        pubmedId,
    } = citation;

    switch (format) {
        case 'MLA':
            return `${authors}. "${title}." ${journal} ${year}. PubMed ID: ${pubmedId}.`;
        case 'APA':
            return `${authors} (${year}). ${title}. ${journal}. PubMed ID: ${pubmedId}.`;
        case 'Chicago':
            return `${authors}. "${title}." ${journal} (${year}). PubMed ID: ${pubmedId}.`;
        case 'Harvard':
            return `${authors} (${year}). ${title}. ${journal}. PubMed ID: ${pubmedId}.`;
        case 'Vancouver':
            return `${authors}. ${title}. ${journal}. ${year}. PubMed ID: ${pubmedId}.`;
        default:
            return '';
    }
};

const generateBibTeX = (citation) => {
    const {
        title,
        year,
        journal,
        authors,
        pubmedId,
    } = citation;

    return `@article{${pubmedId},\n  author = {${authors}},\n  title = {${title}},\n  journal = {${journal}},\n  year = {${year}},\n  note = {PubMed ID: ${pubmedId}}\n}`;
};

const generateEndNote = (citation) => {
    const {
        title,
        year,
        journal,
        authors,
        pubmedId,
    } = citation;

    return `%0 Journal Article\n%A ${authors}\n%T ${title}\n%J ${journal}\n%D ${year}\n%M ${pubmedId}`;
};

const CiteDialog = ({ open, onClose, citation }) => {
    const normalizedCitation = useMemo(() => normalizeCitation(citation), [citation]);

    const handleCopyCitation = (format) => {
        let text = '';
        if (format === 'BibTeX') {
            text = generateBibTeX(normalizedCitation);
        } else if (format === 'EndNote') {
            text = generateEndNote(normalizedCitation);
        } else {
            text = generateCitation(format, normalizedCitation);
        }

        navigator.clipboard.writeText(text)
            .then(() => {
                message.success(`${format} citation copied to clipboard`);
            })
            .catch((error) => {
                console.error('Failed to copy citation: ', error);
                message.error('Copy failed');
            });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    padding: '8px',
                },
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'Open Sans, sans-serif',
                fontSize: '20px',
                fontWeight: 600,
            }}>
                Cite
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    {FORMATS.map((format) => (
                        <Box key={format}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                            }}>
                                <Typography sx={{
                                    fontFamily: 'Open Sans, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                }}>
                                    {format}
                                </Typography>
                            </Box>
                            <Box sx={{
                                backgroundColor: '#f5f5f5',
                                padding: '12px',
                                borderRadius: '8px',
                                fontFamily: 'Open Sans, sans-serif',
                                fontSize: '14px',
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: '#ebebeb',
                                },
                            }}
                                onClick={() => handleCopyCitation(format)}
                            >
                                {generateCitation(format, normalizedCitation)}
                            </Box>
                        </Box>
                    ))}

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <MuiButton
                            variant="outlined"
                            onClick={() => handleCopyCitation('BibTeX')}
                            sx={{
                                fontFamily: 'Open Sans, sans-serif',
                                textTransform: 'none',
                                borderRadius: '8px',
                                padding: '8px 24px',
                            }}
                        >
                            BibTeX
                        </MuiButton>
                        <MuiButton
                            variant="outlined"
                            onClick={() => handleCopyCitation('EndNote')}
                            sx={{
                                fontFamily: 'Open Sans, sans-serif',
                                textTransform: 'none',
                                borderRadius: '8px',
                                padding: '8px 24px',
                            }}
                        >
                            EndNote
                        </MuiButton>
                    </Box>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};

export default CiteDialog;
