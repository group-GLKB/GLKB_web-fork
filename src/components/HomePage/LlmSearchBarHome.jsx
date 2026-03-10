import React, {
    useEffect,
    useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
    Autocomplete,
    Box,
    Paper,
    Popper,
    TextField,
} from '@mui/material';

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const inputTimeoutRef = React.useRef(null);
    const hasTrackedInputRef = React.useRef(false);
    const lastPrefillRef = React.useRef(undefined);
    useEffect(() => {
        // console.log(props);
        props.setOpen(isOpen);
    }, [isOpen, props]);

    useEffect(() => {
        if (typeof props.prefillQuery !== 'string') {
            return;
        }

        if (props.prefillQuery !== lastPrefillRef.current) {
            lastPrefillRef.current = props.prefillQuery;
            setLlmQuery(props.prefillQuery);
        }
    }, [props.prefillQuery]);

    const CustomPopper = (props) => (
        <Popper
            {...props}
            placement="bottom-start"
            disablePortal={true}
            modifiers={[
                {
                    name: 'flip',
                    enabled: false, // prevent flipping to top
                },
                {
                    name: 'preventOverflow',
                    enabled: false,
                },
                {
                    name: 'offset',
                    options: { offset: [0, 16] },
                },
            ]}
        />
    );
    const navigateToLLMAgent = (query = '') => {
        // Clear input timeout to prevent search_input event after submission
        if (inputTimeoutRef.current) {
            clearTimeout(inputTimeoutRef.current);
            hasTrackedInputRef.current = true;
        }
        if (query) {
            navigate('/chat', { state: { initialQuery: query } });
        } else {
            navigate('/chat');
        }
    };
    return (
        <Box className="llm-searchbar" sx={{
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
            <Autocomplete
                freeSolo
                fullWidth
                options={props.autocompleteOptions || []}
                filterOptions={(options) => (llmQuery?.trim() === '' ? options : [])}
                onChange={(event, newValue) => {
                    setLlmQuery(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                    setLlmQuery(newInputValue || '');
                }}
                openOnFocus
                groupBy={() => 'Example Queries'}
                getOptionLabel={(option) => option}
                ListboxProps={{
                    className: 'homepage-autocomplete-listbox',
                    style: {
                        maxHeight: 320,
                        overflowY: 'auto',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    },
                }}
                inputValue={llmQuery}
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                PopperComponent={CustomPopper}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder="Ask a question about the biomedical literature..."
                        multiline
                        minRows={4}
                        maxRows={4}
                        sx={{
                            height: '130px',
                            width: '100%',
                            '& .MuiInputBase-root': {
                                borderRadius: '16px',
                                height: '130px',
                                alignItems: 'flex-start',
                                paddingLeft: '20px',
                                paddingRight: '100px !important',
                                paddingTop: '10px',
                                paddingBottom: '10px',
                                fontFamily: 'Open Sans, sans-serif',
                                fontSize: '18px',
                                color: '#164563',
                                '& fieldset': {
                                    border: 'none',
                                },
                            },
                            '& .MuiInputBase-input': {
                                lineHeight: '26px',
                                maxHeight: '100px',
                            },
                            '& .MuiInputBase-input::placeholder': {
                                color: '#969696',
                                opacity: 1,
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'grey', // Optional: Customize border color
                            },
                        }}
                        fullWidth
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <Box display="flex" alignItems="center" sx={{
                                    position: 'absolute',
                                    right: 12,
                                    bottom: 13,
                                    top: 'auto',
                                    gap: 1,
                                }}>
                                    {/* Clear Icon */}
                                    {llmQuery !== "" && <CloseIcon
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                        }}
                                        onClick={() => {
                                            setLlmQuery(''); // Clear the input field
                                        }}
                                        sx={{
                                            color: 'grey.500',
                                            cursor: 'pointer',
                                            fontSize: '20px',
                                        }}
                                    />}
                                    {/* Search Icon */}
                                    <Box
                                        role="button"
                                        aria-label="Start chat"
                                        className="search-button-big"
                                        onClick={!llmQuery.trim() ? undefined : () => { navigateToLLMAgent(llmQuery.trim()); }}
                                        sx={{
                                            height: '48px',
                                            width: '48px',
                                            borderRadius: '50%',
                                            backgroundColor: !llmQuery.trim() ? '#9fb6ff' : '#155DFC',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: !llmQuery.trim() ? 'not-allowed' : 'pointer',
                                            transition: 'transform 120ms ease, box-shadow 160ms ease',
                                            boxShadow: !llmQuery.trim() ? 'none' : '0 6px 12px rgba(21, 93, 252, 0.28)',
                                            '&:hover': {
                                                transform: !llmQuery.trim() ? 'none' : 'translateY(-1px)',
                                            },
                                        }}
                                    >
                                        <SearchIcon sx={{ color: '#ffffff', fontSize: '22px' }} />
                                    </Box>
                                </Box>
                            ),
                        }}

                    />
                )}
                PaperComponent={({ children }) => (
                    <Paper className="homepage-autocomplete-panel">
                        {children}
                    </Paper>
                )}
                renderOption={(props, option) => (
                    <Box
                        component="li"
                        {...props}
                        className="homepage-autocomplete-option"
                        sx={{
                            whiteSpace: 'normal',
                            alignItems: 'flex-start',
                            lineHeight: 1.4,
                        }}
                    >
                        {option}
                        <span className="homepage-examples-arrow">
                            <ArrowOutwardIcon fontSize="small" />
                        </span>
                    </Box>
                )}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && llmQuery !== "") {
                        e.preventDefault();
                        navigateToLLMAgent(llmQuery.trim());
                    }
                }}
            />

        </Box>
    );
});

export default LlmSearchBar;
