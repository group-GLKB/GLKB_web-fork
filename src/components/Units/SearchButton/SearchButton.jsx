import React from 'react';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box } from '@mui/material';

export default function SearchButton({ onClick, disabled, alterColor = undefined, hide = false }) {
    return (
        <Box
            className="search-button-big"
            sx={{
                height: "62px",
                width: "62px",
                transform: "translateX(2px)",
                borderRadius: "50%",
                background: hide ? "transparent" :
                    disabled ? "#0169B060" :
                        alterColor ? "#079BD4" : "#0169B0"
                ,
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
                    color: !hide ? "white" :
                        disabled ? "#0169B060" :
                            alterColor ? "#079BD4" : "#0169B0",
                    cursor: 'pointer',
                    fontSize: '35px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            />
        </Box>
    );
}