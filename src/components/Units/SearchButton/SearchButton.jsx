import React from 'react';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box } from '@mui/material';

export default function SearchButton({ onClick, disabled }) {
    return (
        <Box
            sx={{
                height: "60px",
                width: "60px",
                borderRadius: "50%",
                background: disabled ? "linear-gradient(90.46deg, rgba(112, 134, 253, 0.3) 0.44%, rgba(70, 99, 254, 0.3) 99.65%)" : "linear-gradient(90.46deg, #7086FD 0.44%, #4663FE 99.65%)",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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