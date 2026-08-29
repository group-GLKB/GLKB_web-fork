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
    isRunElsewhere = false,
    isQueryLimitReached = false,
    // Investigate is fixed for the life of a session, so the bar reports the
    // mode for analytics but no longer renders a toggle.
    investigateEnabled = false,
    onSubmit,
    onStop,
}) => {
    const isMobileViewport = useMediaQuery('(max-width:700px)');
    /* Two different situations wear the same `isLoading`, and the field stays usable in both.

       THIS conversation is answering: a submit is queued by the parent, so a follow-up that
       occurs to the reader mid-answer leaves their hands at once instead of being held in
       their head for the length of a run. A second turn here really would race the first.

       ANOTHER conversation is answering (`isRunElsewhere`): nothing is racing. That run has
       its own session and its own history id, and the backend locks per history id — so this
       question simply starts, and the other answer goes on being written. The field used to
       be disabled here, which meant "New Chat" during a run led to a composer that could not
       be typed in. */
    const canType = !isQueryLimitReached;
    const canSend = Boolean(userInput.trim()) && canType;
    // Stop is what the button offers when there is nothing to send. Typing turns it back into
    // send, which is also how a reader gets out of a queued follow-up they no longer want:
    // clear the field and the stop control is there again. There is nothing here to stop when
    // the run belongs to another thread.
    const showStop = isLoading && !isRunElsewhere && !canSend;
    const placeholder = isRunElsewhere
        ? (isMobileViewport ? 'Ask something new…' : 'Ask a new question — the other answer keeps writing')
        : (isLoading
            ? (isMobileViewport ? 'Ask next…' : 'Ask a follow-up — it will send when this answer finishes')
            : (isMobileViewport ? 'Ask more...' : 'Ask a question about the biomedical literature...'));

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
                onChange={(e) => {
                    if (!canType) return;
                    setUserInput(e.target.value);
                }}
                disabled={!canType}
                variant="outlined"
                placeholder={placeholder}
                multiline
                minRows={1}
                maxRows={4}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                        e.preventDefault();
                        if (canSend) {
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
                            {userInput !== '' && !isQueryLimitReached && !isLoading && (
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
                            {showStop ? (
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label="Stop generating"
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
                                        border: 'none',
                                        padding: 0,
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
                                    component="button"
                                    type="button"
                                    aria-label={isLoading ? 'Send when this answer finishes' : 'Send'}
                                    aria-disabled={!canSend}
                                    onClick={(event) => {
                                        if (!canSend) return;
                                        trackGtagEvent('chat_submit_click', {
                                            source: 'chat_searchbar',
                                            investigate: Boolean(investigateEnabled),
                                            queued: false,
                                        });
                                        onSubmit?.(event);
                                    }}
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        backgroundColor: canSend ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)',
                                        border: 'none',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: canSend ? 'pointer' : 'default',
                                    }}
                                    title={isLoading ? 'Send when this answer finishes' : 'Send'}
                                >
                                    <SearchArrowIcon
                                        style={{
                                            width: 16,
                                            height: 16,
                                            color: canSend ? 'var(--color-neutral-white)' : 'var(--color-brand-primary)',
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
