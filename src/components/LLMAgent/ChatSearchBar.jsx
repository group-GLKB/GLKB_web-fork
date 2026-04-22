import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  TextField,
} from '@mui/material';

const ChatSearchBar = ({
    userInput,
    setUserInput,
    isLoading,
    isQueryLimitReached = false,
    onSubmit,
    onStop,
}) => (
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
                placeholder="Ask a question about the biomedical literature..."
                multiline
                minRows={1}
                maxRows={4}
                sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                        borderRadius: '16px',
                        minHeight: '64px',
                        height: 'auto',
                        alignItems: 'flex-start',
                        paddingLeft: '20px',
                        paddingRight: '90px !important',
                        paddingTop: '12px',
                        paddingBottom: '12px',
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
                                    ? onStop
                                    : (!userInput.trim() || isQueryLimitReached ? undefined : () => onSubmit())}
                                sx={{
                                    height: '44px',
                                    width: '44px',
                                    borderRadius: '50%',
                                    backgroundColor: isLoading
                                        ? '#E7F1FF'
                                        : (!userInput.trim() || isQueryLimitReached ? '#9fb6ff' : '#155DFC'),
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
                                        transform: isLoading
                                            ? 'none'
                                            : (!userInput.trim() || isQueryLimitReached ? 'none' : 'translateY(-1px)'),
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
                                    <SearchIcon sx={{ color: '#ffffff', fontSize: '20px' }} />
                                )}
                            </Box>
                        </Box>
                    ),
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && userInput.trim() !== '' && !isLoading && !isQueryLimitReached) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
            />
        </Box>
    </div>
);

export default ChatSearchBar;
