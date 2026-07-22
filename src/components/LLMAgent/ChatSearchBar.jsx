import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';
import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
import { trackGtagEvent } from '../../utils/gtag';

const ChatSearchBar = ({
    userInput,
    setUserInput,
    isLoading,
    isQueryLimitReached = false,
    investigateEnabled = false,
    onInvestigateChange,
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
            flexDirection: 'column',
            paddingBottom: '8px',
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
                    if (e.key === 'Enter' && !e.shiftKey) {
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
                            {isLoading ? (
                                <Box
                                    onClick={() => {
                                        trackGtagEvent('chat_stop_click', { source: 'chat_searchbar' });
                                        onStop?.();
                                    }}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        backgroundColor: '#222A38',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                    title="Stop"
                                >
                                    <Box sx={{ width: 12, height: 12, backgroundColor: '#fff', borderRadius: '2px' }} />
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
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        backgroundColor: userInput.trim() && !isQueryLimitReached ? '#155DFC' : '#CBD2E0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: userInput.trim() && !isQueryLimitReached ? 'pointer' : 'default',
                                    }}
                                    title="Send"
                                >
                                    <SearchArrowIcon style={{ width: 18, height: 18 }} />
                                </Box>
                            )}
                        </Box>
                    ),
                }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', px: '12px', gap: 1 }}>
                <Button
                    disabled={isLoading || isQueryLimitReached}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const next = !investigateEnabled;
                        trackGtagEvent('chat_investigate_toggle_click', { enabled: next });
                        onInvestigateChange?.(next);
                    }}
                    startIcon={<InvestigateIcon style={{ width: 16, height: 16 }} />}
                    title={investigateEnabled ? 'Investigate on' : 'Investigate off'}
                    sx={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        height: '32px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: 'none',
                        background: investigateEnabled ? '#EEF3FF' : 'transparent',
                        color: investigateEnabled ? '#155DFC' : '#5E6E87',
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: 600,
                        fontSize: '13px',
                        lineHeight: '16px',
                        textTransform: 'none',
                        minWidth: 0,
                        boxShadow: 'none !important',
                        '& .MuiButton-startIcon': { margin: 0 },
                        '&:hover': {
                            border: 'none',
                            background: investigateEnabled ? '#DBEBFF' : '#F4F8FF',
                            color: investigateEnabled ? '#0E4EDB' : '#475B79',
                        },
                    }}
                >
                    Investigate
                </Button>
            </Box>
        </Box>
        </div>
    );
};

export default ChatSearchBar;
