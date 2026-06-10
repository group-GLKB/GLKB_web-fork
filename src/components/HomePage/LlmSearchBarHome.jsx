import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import {
  Autocomplete,
  Box,
  MenuItem,
  Paper,
  Popper,
  Select,
  TextField,
} from '@mui/material';

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    const [sortBy, setSortBy] = useState('Default');
    const [paperType, setPaperType] = useState('All');
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const inputTimeoutRef = React.useRef(null);
    const hasTrackedInputRef = React.useRef(false);
    const lastPrefillRef = React.useRef(undefined);
    const isQueryLimitReached = Boolean(props.isQueryLimitReached);
    useEffect(() => {
        // console.log(props);
        props.setOpen(isOpen);
    }, [isOpen, props]);

    useEffect(() => {
        if (!props.setExamplesOpen) return;
        const hasAutocompleteExamples = Array.isArray(props.autocompleteOptions)
            && props.autocompleteOptions.length > 0;
        const isExamplePanelExpanded = isOpen && hasAutocompleteExamples && llmQuery.trim() === '';
        props.setExamplesOpen(isExamplePanelExpanded);
    }, [isOpen, llmQuery, props]);

    useEffect(() => () => {
        if (props.setExamplesOpen) {
            props.setExamplesOpen(false);
        }
    }, [props]);

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
    const sortOptions = ['Default', 'Relevance', 'Latest', 'Oldest'];
    const paperTypeOptions = ['All', 'Review', 'Clinical Trial', 'Meta-analysis'];

    return (
        <Box
            className="llm-searchbar"
            sx={{
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
                disabled={isQueryLimitReached}
                options={props.autocompleteOptions || []}
                filterOptions={(options) => (llmQuery?.trim() === '' ? options : [])}
                onChange={(event, newValue) => {
                    if (isQueryLimitReached) return;
                    setLlmQuery(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                    if (isQueryLimitReached) return;
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
                onOpen={() => {
                    if (isQueryLimitReached) {
                        return;
                    }
                    setIsOpen(true);
                }}
                onClose={() => setIsOpen(false)}
                PopperComponent={CustomPopper}
                renderInput={(params) => (
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <TextField
                            {...params}
                            placeholder="Ask a question about the biomedical literature..."
                            multiline
                            minRows={4}
                            maxRows={4}
                            disabled={isQueryLimitReached}
                            sx={{
                                height: '130px',
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    borderRadius: '16px',
                                    height: '130px',
                                    alignItems: 'flex-start',
                                    paddingLeft: '20px',
                                    paddingRight: '20px !important',
                                    paddingTop: '0px',
                                    paddingBottom: '58px',
                                    fontFamily: 'Open Sans, sans-serif',
                                    fontSize: '18px',
                                    color: '#164563',
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    lineHeight: '26px',
                                    height: '62px !important',
                                    maxHeight: '62px !important',
                                    overflowY: 'auto !important',
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: '#969696',
                                    opacity: 1,
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'grey',
                                },
                            }}
                            fullWidth
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: null,
                            }}
                        />

                        <Box
                            sx={{
                                position: 'absolute',
                                left: '20px',
                                right: '12px',
                                bottom: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 2,
                                pointerEvents: 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: '#8A8A8A',
                                    fontFamily: 'Open Sans, sans-serif',
                                    fontSize: '18px',
                                    lineHeight: '26px',
                                    pointerEvents: 'auto',
                                }}
                            >
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                                    <span style={{ color: '#8A8A8A' }}>Sort by:</span>
                                    <Select
                                        value={sortBy}
                                        onChange={(event) => setSortBy(event.target.value)}
                                        variant="standard"
                                        disableUnderline
                                        MenuProps={{ disableScrollLock: true }}
                                        sx={{
                                            minWidth: '0px',
                                            color: '#111111',
                                            fontFamily: 'Open Sans, sans-serif',
                                            fontSize: '18px',
                                            lineHeight: '26px',
                                            '& .MuiSelect-select': {
                                                padding: '0 !important',
                                                minHeight: 'unset',
                                            },
                                            '& .MuiSelect-icon': {
                                                display: 'none',
                                            },
                                        }}
                                    >
                                        {sortOptions.map((option) => (
                                            <MenuItem key={option} value={option}>{option}</MenuItem>
                                        ))}
                                    </Select>
                                    <SortIcon sx={{ color: '#8A8A8A', fontSize: '20px' }} />
                                </Box>

                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                                    <span style={{ color: '#8A8A8A' }}>Paper type:</span>
                                    <Select
                                        value={paperType}
                                        onChange={(event) => setPaperType(event.target.value)}
                                        variant="standard"
                                        disableUnderline
                                        MenuProps={{ disableScrollLock: true }}
                                        sx={{
                                            minWidth: '0px',
                                            color: '#111111',
                                            fontFamily: 'Open Sans, sans-serif',
                                            fontSize: '18px',
                                            lineHeight: '26px',
                                            '& .MuiSelect-select': {
                                                padding: '0 !important',
                                                minHeight: 'unset',
                                            },
                                            '& .MuiSelect-icon': {
                                                display: 'none',
                                            },
                                        }}
                                    >
                                        {paperTypeOptions.map((option) => (
                                            <MenuItem key={option} value={option}>{option}</MenuItem>
                                        ))}
                                    </Select>
                                    <FilterAltOutlinedIcon sx={{ color: '#8A8A8A', fontSize: '20px' }} />
                                </Box>
                            </Box>

                            <Box
                                role="button"
                                aria-label="Start chat"
                                className="search-button-big"
                                onClick={() => { navigateToLLMAgent(llmQuery.trim()); }}
                                sx={{
                                    height: '48px',
                                    width: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: '#E7F1FF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 120ms ease, box-shadow 160ms ease',
                                    boxShadow: '0px 1px 2px -1px rgba(0, 0, 0, 0.10), 0px 1px 3px rgba(0, 0, 0, 0.10)',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                    },
                                    pointerEvents: 'auto',
                                }}
                            >
                                <SearchIcon sx={{ color: '#155DFC', fontSize: '22px' }} />
                            </Box>
                        </Box>
                    </Box>
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
                    if (isQueryLimitReached) {
                        e.preventDefault();
                        return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey && llmQuery.trim() !== "") {
                        e.preventDefault();
                        navigateToLLMAgent(llmQuery.trim());
                    }
                }}
            />

        </Box>
    );
});

export default LlmSearchBar;
