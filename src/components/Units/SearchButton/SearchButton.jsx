import React from 'react';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box } from '@mui/material';

export default function SearchButton({ onClick, disabled, alterColor = false }) {
    return (
        <Box
            className="search-button-big"
            sx={{
                height: "61.333px",
                width: "61.333px",
                transform: "translateX(1px)",
                borderRadius: "50%",
                background: disabled ? "#0169B060" : (alterColor ? "#079BD4" : "#0169B0"),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            <ArrowForwardIcon
                className="search-button"
                onClick={disabled ? () => { } : onClick}
                sx={{
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '35px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            />
        </Box>
    );
}