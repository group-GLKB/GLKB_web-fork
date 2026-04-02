import React from 'react';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import { Box } from '@mui/material';

export default function SearchButton({
    onClick,
    disabled,
    alterColor = undefined,
    hide = false,
    size = 62,
    variant = 'default',
}) {
    const iconSize = Math.round(size * 0.56);
    const isHomeVariant = variant === 'home';
    const backgroundColor = hide ? 'transparent' :
        disabled ? (isHomeVariant ? '#9fb6ff' : '#0169B060') :
            isHomeVariant ? '#155DFC' : (alterColor ? '#079BD4' : '#0169B0');
    const iconColor = isHomeVariant ? '#ffffff' : (!hide ? 'white' :
        disabled ? '#0169B060' :
            alterColor ? '#079BD4' : '#0169B0');
    const buttonShadow = isHomeVariant && !disabled && !hide
        ? '0 6px 12px rgba(21, 93, 252, 0.28)'
        : 'none';
    const ButtonIcon = isHomeVariant ? SearchIcon : ArrowForwardIcon;
    return (
        <Box
            className="search-button-big"
            sx={{
                height: `${size}px`,
                width: `${size}px`,
                transform: isHomeVariant ? 'none' : 'translateX(2px)',
                borderRadius: "50%",
                background: backgroundColor,
                boxShadow: buttonShadow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: isHomeVariant ? 'transform 120ms ease, box-shadow 160ms ease' : 'none',
                '&:hover': {
                    transform: !isHomeVariant || disabled ? 'none' : 'translateY(-1px)',
                },
            }}
            onClick={disabled ? () => { } : onClick}
        >
            <ButtonIcon
                className="search-button"
                sx={{
                    color: iconColor,
                    cursor: 'pointer',
                    fontSize: `${iconSize}px`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    pointerEvents: 'none',
                }}
            />
        </Box>
    );
}