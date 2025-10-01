import React, {
    useEffect,
    useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import {
    Autocomplete,
    Box,
    Paper,
    Popper,
    TextField,
} from '@mui/material';

import { trackEvent } from '../Units/analytics';
import SearchButton from '../Units/SearchButton/SearchButton';

const LLMExampleQueries = [
    "What is the role of BRCA1 in breast cancer?",
    "How many articles about Alzheimer's disease were published in 2020?",
    "What pathways does TP53 participate in?",
];

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        // console.log(props);
        props.setOpen(isOpen);
    }, [isOpen, props]);

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
                }
            ]}
        />
    );
    const navigateToLLMAgent = (query = '') => {
        // Track event
        trackEvent('Navigation', 'Navigate to LLM Agent', query ? 'With Query' : 'Direct Navigation');
        if (query) {
            navigate('/llm-agent', { state: { initialQuery: query } });
        } else {
            navigate('/llm-agent');
        }
    };
    return (
        <Box className="llm-searchbar" sx={{
            width: '100%',
            display: 'flex',
            gap: 2,
            margin: '0 auto',
            backgroundColor: 'white',
            borderRadius: (isOpen && llmQuery?.trim() === '') ? '30px 30px 0px 0px' : '30px',
            borderWidth: (isOpen && llmQuery?.trim() === '') ? '0px 1px 1px 1px' : '1px',
            borderStyle: 'solid',
            borderColor: '#E6F0FC',
            boxShadow: '0px 2px 3px -1px #00000026',
        }}>
            <Autocomplete
                freeSolo
                fullWidth
                options={LLMExampleQueries}
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
                // onFocus={() => setFocused(true)}
                // onBlur={() => setFocused(false)}
                inputValue={llmQuery}
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                PopperComponent={CustomPopper}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder="Ask a question about the biomedical literature..."
                        sx={{
                            height: '60px', // Increase the height of the input box
                            width: '100%',
                            '& .MuiInputBase-root': {
                                borderRadius: '30px',
                                height: '60px', // Adjust the height of the input field
                                alignItems: 'center', // Center the text vertically
                                paddingRight: '10px', // Remove right padding
                                fontFamily: 'Open Sans, sans-serif',
                                '& fieldset': {
                                    border: 'none',
                                },
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'grey', // Optional: Customize border color
                            },
                        }}
                        fullWidth
                        InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                                <>
                                    <ChatBubbleOutlineIcon sx={{ color: '#a1a1a1', marginLeft: '20px', fontSize: '20px' }} />
                                    {params.InputProps.startAdornment}
                                </>
                            ),
                            endAdornment: (
                                <Box display="flex" alignItems="center" sx={{
                                    position: 'absolute',
                                    right: 0,
                                }}>
                                    {/* Clear Icon */}
                                    {llmQuery !== "" && <CloseIcon
                                        onClick={() => {
                                            setLlmQuery(''); // Clear the input field
                                        }}
                                        sx={{
                                            color: 'grey.500',
                                            cursor: 'pointer',
                                            fontSize: '20px', // Adjust size as needed
                                            marginRight: '8px', // Add spacing from the SendIcon
                                        }}
                                    />}
                                    {/* Search Icon */}
                                    <SearchButton
                                        onClick={() => { navigateToLLMAgent(llmQuery.trim()); }}
                                        disabled={!llmQuery.trim()}
                                        hide={(isOpen && llmQuery?.trim() === '')}
                                    />
                                </Box>
                            ),
                        }}

                    />
                )}
                PaperComponent={({ children }) => (
                    <Paper
                        sx={{
                            boxShadow: 'none',
                            borderRadius: '0px 0px 30px 30px',
                            borderWidth: '0px 1px 1px 1px',
                            borderStyle: 'solid',
                            borderColor: '#E6F0FC',
                            boxShadow: '0px 2px 3px -1px #00000026',
                            marginBottom: '5px',
                            paddingTop: '0px',
                            overflow: 'hidden',
                            fontFamily: 'Open Sans, sans-serif',
                            "& .MuiAutocomplete-option.Mui-focused": {
                                backgroundColor: '#EDF5FE !important',
                            },
                            "& .MuiAutocomplete-option.Mui-focused span.highlight-arrow": {
                                color: '#196ED8 !important',
                            },
                            "& .MuiAutocomplete-listbox": {
                                paddingTop: '0px'
                            },
                            "& .MuiAutocomplete-groupLabel": {
                                height: '36px',
                                fontFamily: 'Open Sans, sans-serif',
                            }
                        }}
                    >
                        {children}
                    </Paper>
                )}
                renderOption={(props, option) => (
                    <Box
                        component="li"
                        {...props}
                        sx={{
                            height: '36px !important',
                            margin: '0px 10px',
                            marginLeft: '0px',
                            paddingLeft: '26px',
                            borderRadius: '0px 18px 18px 0px',
                            '& .MuiAutocomplete-option.Mui-focused': {
                                backgroundColor: '#F3F5FF !important',
                            },
                        }}
                    >
                        {option}
                        <span className={"highlight-arrow"} style={{ color: 'white', marginLeft: 'auto' }}><ArrowOutwardIcon fontSize="small" /></span>
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
