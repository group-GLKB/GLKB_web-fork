import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { ReactComponent as UnionIcon } from '../../img/Union.svg';
import { trackGtagEvent } from '../../utils/gtag';

const ChatSearchBar = ({
    userInput,
    setUserInput,
    isLoading,
    isQueryLimitReached = false,
    onSubmit,
    onStop,
}) => {
    const isMobileViewport = useMediaQuery('(max-width:700px)');

    return (
        <div className="chat-header">
        <Box sx={{
            width: '100%',
            display: 'flex',
            gap: 2,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: '#E7F1FF',
            boxShadow: '0px 6px 18px rgba(22, 69, 99, 0.08)',
        }}>
            <TextField
                className="input-form"
                size="small"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isLoading || isQueryLimitReached}
                variant="outlined"
                placeholder={isMobileViewport ? 'Ask more...' : 'Ask a question about the biomedical literature...'}
                multiline
                minRows={1}
                maxRows={4}
                sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                        borderRadius: '16px',
                        minHeight: { xs: '44px', sm: '64px' },
                        height: 'auto',
                        alignItems: 'flex-start',
                        paddingLeft: '20px',
                        paddingRight: '90px !important',
                        paddingTop: { xs: '8px', sm: '12px' },
                        paddingBottom: { xs: '8px', sm: '12px' },
                        fontFamily: 'Open Sans, sans-serif',
                        fontSize: '18px',
                        color: '#164563',
                        '& fieldset': {
                            border: 'none',
                        },
                    },
                    '& .MuiInputBase-input': {
                        lineHeight: '24px',
                    },
                    '& .MuiInputBase-input::placeholder': {
                        color: '#969696',
                        opacity: 1,
                    },
                }}
                fullWidth
                InputProps={{
                    endAdornment: (
                        <Box
                            display="flex"
                            alignItems="center"
                            sx={{
                                position: 'absolute',
                                right: 12,
                                gap: 1,
                            }}
                        >
                            {userInput !== '' && !isQueryLimitReached && (
                                <CloseIcon
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                    }}
                                    onClick={() => {
                                        trackGtagEvent('chat_input_clear_click', { source: 'chat_searchbar' });
                                        setUserInput('');
                                    }}
                                    sx={{
                                        color: 'grey.500',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                    }}
                                />
                            )}
                            <Box
                                role="button"
                                aria-label={isLoading ? 'Stop' : 'Send'}
                                onClick={isLoading
                                    ? () => {
                                        trackGtagEvent('chat_stop_click', { source: 'chat_searchbar' });
                                        onStop();
                                    }
                                    : (!userInput.trim() || isQueryLimitReached ? undefined : () => {
                                        trackGtagEvent('chat_submit_click', {
                                            source: 'chat_searchbar_button',
                                            input_length: userInput.trim().length,
                                        });
                                        onSubmit();
                                    })}
                                sx={{
                                    height: { xs: '36px', sm: '44px' },
                                    width: { xs: '36px', sm: '44px' },
                                    borderRadius: '50%',
                                    transform: isMobileViewport ? 'translateY(-4px)' : 'none',
                                    backgroundColor: isLoading
                                        ? '#E7F1FF'
                                        : (!userInput.trim() || isQueryLimitReached ? '#E7F1FF' : '#155DFC'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isLoading
                                        ? 'pointer'
                                        : (!userInput.trim() || isQueryLimitReached ? 'not-allowed' : 'pointer'),
                                    transition: 'transform 120ms ease, box-shadow 160ms ease',
                                    boxShadow: isLoading
                                        ? 'none'
                                        : (!userInput.trim() || isQueryLimitReached ? 'none' : '0 6px 12px rgba(21, 93, 252, 0.28)'),
                                    '&:hover': {
                                        transform: isMobileViewport
                                            ? 'translateY(-4px)'
                                            : (isLoading
                                                ? 'none'
                                                : (!userInput.trim() || isQueryLimitReached ? 'none' : 'translateY(-1px)')),
                                    },
                                }}
                            >
                                {isLoading ? (
                                    <Box
                                        sx={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '4px',
                                            backgroundColor: '#155DFC',
                                        }}
                                    />
                                ) : (
                                    <UnionIcon
                                        style={{
                                            color: (!userInput.trim() || isQueryLimitReached) ? '#155DFC' : '#ffffff',
                                            width: isMobileViewport ? '16px' : '20px',
                                            height: isMobileViewport ? '16px' : '20px',
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>
                    ),
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && userInput.trim() !== '' && !isLoading && !isQueryLimitReached) {
                        e.preventDefault();
                        trackGtagEvent('chat_submit_enter', {
                            source: 'chat_searchbar_input',
                            input_length: userInput.trim().length,
                        });
                        onSubmit();
                    }
                }}
            />
        </Box>
        </div>
    );
};

export default ChatSearchBar;
