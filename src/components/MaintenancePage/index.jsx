import './scoped.css';

import React from 'react';

import { Helmet } from 'react-helmet-async';

import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import { Button } from '@mui/material';

const MAINTENANCE_DAYS = 2;

const MaintenancePage = () => (
    <div className="maintenance-page">
        <Helmet>
            <title>Maintenance | GLKB</title>
            <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main className="maintenance-main">
            <HandymanOutlinedIcon className="maintenance-icon" />

            <h1 className="maintenance-title">GLKB is under maintenance.</h1>

            <p className="maintenance-subtitle">
                We&apos;ll be back in
                {' '}
                <span className="maintenance-days">{MAINTENANCE_DAYS}</span>
                {' '}
                days, stay tuned!
            </p>

            <Button
                component="a"
                href="mailto:admin@glkb.org"
                className="maintenance-contact-button"
                variant="contained"
                disableElevation
                sx={{
                    background: 'var(--color-blue-500)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '16px',
                    fontWeight: 500,
                    marginTop: '48px',
                    padding: '8px 16px',
                    textTransform: 'none',
                    minWidth: 0,
                    lineHeight: 'normal',
                    letterSpacing: 'normal',
                    boxShadow: 'none',
                    '&:hover': {
                        background: 'var(--color-blue-500)',
                        border: 'none',
                        boxShadow: 'none',
                    },
                    '&.Mui-focusVisible': {
                        boxShadow: 'none',
                    },
                }}
            >
                Contact us
            </Button>
        </main>

        <footer className="maintenance-footer">
            <p>
                © 2025 GLKB - Genomic Literature Knowledge Base | glkb.org
            </p>
            <p>
                Developed and maintained by the
                {' '}
                <a className="maintenance-lab-link" href="https://jieliu6.github.io/" target="_blank" rel="noopener noreferrer">
                    Jie Liu Lab
                </a>
                , Department of Computational Medicine and Bioinformatics, University of Michigan.
            </p>
        </footer>
    </div>
);

export default MaintenancePage;
