import './scoped.css';

import React from 'react';

import {
  Box,
  Typography,
} from '@mui/material';

import {
  ReactComponent as CodeBlocksIcon,
} from '../../img/navbar/code_blocks.svg';

const ApiPage = () => (
    <div className="api-page">
        <Box className="api-body">
            <Box className="api-content">
                <Box className="api-header">
                    <Box className="api-title-row">
                        <CodeBlocksIcon className="api-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                        <Typography sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 600,
                            fontSize: '32px',
                            color: '#164563',
                        }}>
                            API
                        </Typography>
                    </Box>
                    <Typography sx={{
                        marginTop: '8px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: '#646464',
                    }}>
                        Browse the GLKB API documentation without leaving the app.
                    </Typography>
                </Box>
                <Box className="api-frame-wrap">
                    <iframe
                        className="api-frame"
                        title="GLKB API Documentation"
                        src="https://glkb.dcmb.med.umich.edu/docs"
                        loading="lazy"
                    />
                </Box>
                <Typography className="api-note">
                    If the docs do not load, your browser may block embedding for security reasons.
                </Typography>
            </Box>
        </Box>
    </div>
);

export default ApiPage;
