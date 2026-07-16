import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
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
            backgroundColor: '#F2F4F8',
            borderRadius: '16px',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: '#E5E9F0',
            boxShadow: 'none',
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
                        paddingRight: '76px !important',
                        paddingTop: { xs: '8px', sm: '12px' },
                        paddingBottom: { xs: '8px', sm: '12px' },
                        fontFamily: 'Open Sans, sans-serif',
                        fontSize: '14px',
                        color: '#0C1018',
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
                                    height: '32px',
                                    width: '32px',
                                    borderRadius: '8px',
                                    transform: 'none',
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
                                    boxShadow: 'none',
                                    '&:hover': {
                                        transform: isLoading || !userInput.trim() || isQueryLimitReached ? 'none' : 'translateY(-1px)',
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
                                    <SearchArrowIcon
                                        style={{
                                            color: (!userInput.trim() || isQueryLimitReached) ? '#155DFC' : '#ffffff',
                                            width: '16px',
                                            height: '16px',
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
