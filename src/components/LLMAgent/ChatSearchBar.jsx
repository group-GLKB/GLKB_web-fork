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
    // Investigate is fixed for the life of a session, so the bar reports the
    // mode for analytics but no longer renders a toggle.
    investigateEnabled = false,
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
            backgroundColor: 'var(--color-background-subtle)',
            borderRadius: '16px',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--color-border-default)',
            boxShadow: 'none',
            flexDirection: 'column',
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
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                        e.preventDefault();
                        if (!isLoading && !isQueryLimitReached && userInput.trim()) {
                            onSubmit?.(e);
                        }
                    }
                }}
                sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                        borderRadius: '16px',
                        minHeight: { xs: '44px', sm: '52px' },
                        height: 'auto',
                        alignItems: 'center',
                        paddingLeft: '20px',
                        paddingRight: '60px !important',
                        paddingTop: { xs: '8px', sm: '10px' },
                        paddingBottom: { xs: '8px', sm: '10px' },
                        fontFamily: 'Geist, sans-serif',
                        fontSize: '14px',
                        color: 'var(--color-text-primary)',
                        '& fieldset': {
                            border: 'none',
                        },
                    },
                    '& .MuiInputBase-input': {
                        lineHeight: '24px',
                    },
                    '& .MuiInputBase-input::placeholder': {
                        color: 'var(--color-grey-300)',
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
                            {isLoading ? (
                                <Box
                                    onClick={() => {
                                        trackGtagEvent('chat_stop_click', { source: 'chat_searchbar' });
                                        onStop?.();
                                    }}
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        // Same brand-muted square as the idle send button — the
                                        // near-black fill it used to have belonged to no palette here.
                                        backgroundColor: 'var(--color-brand-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                    title="Stop"
                                >
                                    <Box sx={{ width: 12, height: 12, backgroundColor: 'var(--color-brand-primary)', borderRadius: '2px' }} />
                                </Box>
                            ) : (
                                <Box
                                    onClick={(event) => {
                                        if (!userInput.trim() || isQueryLimitReached) return;
                                        trackGtagEvent('chat_submit_click', {
                                            source: 'chat_searchbar',
                                            investigate: Boolean(investigateEnabled),
                                        });
                                        onSubmit?.(event);
                                    }}
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        backgroundColor: userInput.trim() && !isQueryLimitReached ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: userInput.trim() && !isQueryLimitReached ? 'pointer' : 'default',
                                    }}
                                    title="Send"
                                >
                                    <SearchArrowIcon
                                        style={{
                                            width: 16,
                                            height: 16,
                                            color: userInput.trim() && !isQueryLimitReached ? 'var(--color-neutral-white)' : 'var(--color-brand-primary)',
                                        }}
                                    />
                                </Box>
                            )}
                        </Box>
                    ),
                }}
            />
        </Box>
        </div>
    );
};

export default ChatSearchBar;
