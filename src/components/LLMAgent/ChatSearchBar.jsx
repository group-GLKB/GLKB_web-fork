import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
    Box,
    TextField,
} from '@mui/material';

const ChatSearchBar = ({ userInput, setUserInput, isLoading, onSubmit }) => (
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
                disabled={isLoading}
                variant="outlined"
                placeholder="Ask a question about the biomedical literature..."
                sx={{
                    height: '64px',
                    width: '100%',
                    '& .MuiInputBase-root': {
                        borderRadius: '16px',
                        height: '64px',
                        alignItems: 'center',
                        paddingLeft: '20px',
                        paddingRight: '90px !important',
                        fontFamily: 'Open Sans, sans-serif',
                        fontSize: '18px',
                        color: '#164563',
                        '& fieldset': {
                            border: 'none',
                        },
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
                            {userInput !== '' && (
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
                                aria-label="Send"
                                onClick={!userInput.trim() || isLoading ? undefined : () => onSubmit()}
                                sx={{
                                    height: '44px',
                                    width: '44px',
                                    borderRadius: '50%',
                                    backgroundColor: !userInput.trim() || isLoading ? '#9fb6ff' : '#155DFC',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: !userInput.trim() || isLoading ? 'not-allowed' : 'pointer',
                                    transition: 'transform 120ms ease, box-shadow 160ms ease',
                                    boxShadow: !userInput.trim() || isLoading ? 'none' : '0 6px 12px rgba(21, 93, 252, 0.28)',
                                    '&:hover': {
                                        transform: !userInput.trim() || isLoading ? 'none' : 'translateY(-1px)',
                                    },
                                }}
                            >
                                <SearchIcon sx={{ color: '#ffffff', fontSize: '20px' }} />
                            </Box>
                        </Box>
                    ),
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && userInput !== '' && !isLoading) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
            />
        </Box>
    </div>
);

export default ChatSearchBar;
