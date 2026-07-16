import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Drawer,
  IconButton,
  Paper,
  Popper,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';
import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
import { ReactComponent as SearchOptionsIcon } from '../../img/llm/search_options.svg';
import { trackGtagEvent } from '../../utils/gtag';

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    const [investigateEnabled, setInvestigateEnabled] = useState(false);
    const [sortBy, setSortBy] = useState('Default');
    const [paperType, setPaperType] = useState('All types');
    const [isOpen, setIsOpen] = useState(false);
    const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
    const [desktopOptionsOpen, setDesktopOptionsOpen] = useState(false);
    const navigate = useNavigate();
    const isMobileLayout = useMediaQuery('(max-width:600px)');
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
                    options: { offset: [0, 24] },
                },
            ]}
        />
    );

    const buildSearchOptionsPayload = () => {
        let rankingMode = 'default';
        if (sortBy === 'High impact first') rankingMode = 'high_impact';
        if (sortBy === 'Most recent first') rankingMode = 'recent';

        let filters = [];
        if (paperType === 'Reviews only') filters = ['review'];
        if (paperType === 'Exclude reviews') filters = ['non_review'];

        return {
            filters,
            rankingMode,
            investigateEnabled,
        };
    };

    const navigateToLLMAgent = (query = '') => {
        // Clear input timeout to prevent search_input event after submission
        if (inputTimeoutRef.current) {
            clearTimeout(inputTimeoutRef.current);
            hasTrackedInputRef.current = true;
        }
        const searchOptions = buildSearchOptionsPayload();
        trackGtagEvent('home_search_submit_click', {
            has_query: Boolean(query),
            ranking_mode: searchOptions.rankingMode,
            filters: searchOptions.filters.join(','),
            investigate_enabled: searchOptions.investigateEnabled,
        });
        if (query) {
            navigate('/chat', {
                state: {
                    initialQuery: query,
                    initialSearchOptions: searchOptions,
                },
            });
        } else {
            navigate('/chat', {
                state: {
                    initialSearchOptions: searchOptions,
                },
            });
        }
    };
    const sortOptions = [
        { value: 'Default', label: 'Default' },
        { value: 'High impact first', label: 'High impact' },
        { value: 'Most recent first', label: 'Most recent' },
    ];
    const paperTypeOptions = [
        { value: 'All types', label: 'All types', width: 78 },
        { value: 'Reviews only', label: 'Reviews only', width: 103 },
        { value: 'Exclude reviews', label: 'Exclude reviews', width: 124 },
    ];
    const defaultSortBy = 'Default';
    const defaultPaperType = 'All types';
    const mobileSelectedOptions = [];
    if (paperType !== defaultPaperType) mobileSelectedOptions.push(paperType);
    if (sortBy !== defaultSortBy) mobileSelectedOptions.push(sortBy);
    const mobileChipLabel = mobileSelectedOptions.length > 0 ? mobileSelectedOptions.join(' + ') : 'Search Options';
    const openSearchOptions = () => {
        trackGtagEvent('home_search_options_open_click', {
            source: isMobileLayout ? 'mobile' : 'desktop',
        });
        setIsOpen(false);
        if (props.setExamplesOpen) {
            props.setExamplesOpen(false);
        }
        if (props.onCollapseExampleLists) {
            props.onCollapseExampleLists();
        }
        if (isMobileLayout) {
            setMobileOptionsOpen(true);
            return;
        }
        setDesktopOptionsOpen(true);
    };

    const closeSearchOptions = () => {
        trackGtagEvent('home_search_options_close_click', {
            source: isMobileLayout ? 'mobile' : 'desktop',
        });
        setMobileOptionsOpen(false);
        setDesktopOptionsOpen(false);
    };

    const handleResetSearchOptions = () => {
        trackGtagEvent('home_search_options_reset_click', {
            source: isMobileLayout ? 'mobile' : 'desktop',
        });
        setPaperType(defaultPaperType);
        setSortBy(defaultSortBy);
    };

    const optionChipSx = (isActive, { equalWidth = false, fixedWidth } = {}) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40px',
        minWidth: equalWidth ? 0 : `${fixedWidth || 72}px`,
        padding: '0 8px',
        borderRadius: '8px',
        backgroundColor: isActive ? '#FFFFFF' : 'transparent',
        boxShadow: isActive ? '0px 2px 2px rgba(0, 0, 0, 0.10)' : 'none',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: isActive ? 900 : 600,
        fontSize: '14px',
        lineHeight: '16px',
        color: isActive ? '#155DFC' : '#646464',
        textTransform: 'none',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
            boxShadow: isActive ? '0px 2px 2px rgba(0, 0, 0, 0.10)' : 'none',
        },
        whiteSpace: 'nowrap',
        flex: equalWidth ? '1 0 0' : '0 0 auto',
    });

    const searchOptionsPanel = (
        <>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 2,
                }}
            >
                <Box sx={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: '20px', lineHeight: '24px', color: '#333333' }}>
                    Search Options
                </Box>
                <IconButton onClick={closeSearchOptions} size="small" sx={{ color: '#646464' }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box sx={{ borderTop: '1px solid #EDEDED', mx: '-24px' }} />

            <Box sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                <Box>
                    <Box sx={{ mb: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: '16px', lineHeight: '24px', color: '#333333' }}>
                        Article Type
                    </Box>
                    <Box sx={{ backgroundColor: '#F4F4F4', borderRadius: '10px', p: '4px', display: 'flex', gap: 0, justifyContent: 'space-between' }}>
                        {paperTypeOptions.map((option) => (
                            <Box
                                key={option.value}
                                role="button"
                                onClick={() => {
                                    trackGtagEvent('home_article_type_select_click', {
                                        value: option.value,
                                    });
                                    setPaperType(option.value);
                                }}
                                sx={optionChipSx(option.value === paperType, { fixedWidth: option.width })}
                            >
                                {option.label}
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ mt: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: '16px', color: '#969696' }}>
                        Search every article
                    </Box>
                </Box>

                <Box sx={{ borderTop: '1px solid #EDEDED', mx: '-24px' }} />

                <Box>
                    <Box sx={{ mb: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: '16px', lineHeight: '24px', color: '#333333' }}>
                        Sort by
                    </Box>
                    <Box sx={{ backgroundColor: '#F4F4F4', borderRadius: '10px', p: '4px', display: 'flex', gap: 0, justifyContent: 'space-between' }}>
                        {sortOptions.map((option) => (
                            <Box
                                key={option.value}
                                role="button"
                                onClick={() => {
                                    trackGtagEvent('home_sort_mode_select_click', {
                                        value: option.value,
                                    });
                                    setSortBy(option.value);
                                }}
                                sx={optionChipSx(option.value === sortBy, { equalWidth: true })}
                            >
                                {option.label}
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ mt: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: '16px', color: '#969696' }}>
                        Best matches for your query
                    </Box>
                </Box>
            </Box>

            <Box sx={{ mt: 'auto', pt: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box
                    role="button"
                    onClick={handleResetSearchOptions}
                    sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 900,
                        fontSize: '14px',
                        lineHeight: '16px',
                        color: '#646464',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                    }}
                >
                    Reset
                </Box>
                <Box
                    role="button"
                    onClick={closeSearchOptions}
                    sx={{
                        flex: 1,
                        minWidth: '140px',
                        height: '40px',
                        borderRadius: '999px',
                        backgroundColor: '#155DFC',
                        color: '#FFFFFF',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 900,
                        fontSize: '14px',
                        lineHeight: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    Done
                </Box>
            </Box>
        </>
    );

    return (
        <Box
            className="llm-searchbar"
            sx={{
                width: '100%',
                display: 'flex',
                gap: 2,
                margin: '0 auto',
                fontFamily: 'Geist, sans-serif',
                fontSize: '16px',
                backgroundColor: '#F2F4F8',
                borderRadius: '16px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: '#E5E9F0',
                boxShadow: 'none',
            }}>
            <Autocomplete
                freeSolo
                fullWidth
                open={!mobileOptionsOpen && !desktopOptionsOpen && isOpen}
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
                sx={{
                    '& .MuiAutocomplete-groupLabel': {
                        fontFamily: 'Geist, sans-serif',
                        fontSize: '16px',
                    },
                }}
                renderInput={(params) => (
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <TextField
                            {...params}
                            placeholder="Ask a question about the biomedical literature..."
                            multiline
                            minRows={3}
                            maxRows={9}
                            disabled={isQueryLimitReached}
                            sx={{
                                minHeight: { xs: '148px', sm: '152px' },
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    borderRadius: '16px',
                                    minHeight: { xs: '148px', sm: '152px' },
                                    backgroundColor: '#F2F4F8',
                                    alignItems: 'flex-start',
                                    paddingLeft: '20px',
                                    paddingRight: '20px !important',
                                    paddingTop: '16.5px',
                                    paddingBottom: '58px',
                                    fontFamily: 'Geist, sans-serif',
                                    fontSize: '16px',
                                    color: '#0C1018',
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    lineHeight: '26px',
                                    padding: '0 !important',
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: '#A8B3C8',
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
                                justifyContent: 'space-between',
                                gap: 2,
                                pointerEvents: 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: { xs: '8px', sm: '12px' },
                                    minWidth: 0,
                                    pointerEvents: 'auto',
                                }}
                            >
                                <Button
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setInvestigateEnabled((prev) => {
                                            const next = !prev;
                                            trackGtagEvent('home_investigate_toggle_click', {
                                                enabled: next,
                                            });
                                            return next;
                                        });
                                    }}
                                    sx={{
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        height: '36px',
                                        padding: '8px 12px',
                                        margin: '-8px -12px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        background: investigateEnabled ? '#EEF3FF' : 'transparent',
                                        color: investigateEnabled ? '#155DFC' : '#5E6E87',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        lineHeight: '16px',
                                        textTransform: 'none',
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        boxShadow: 'none !important',
                                        transition: 'background-color 0.18s ease, color 0.18s ease',
                                        '& .MuiButton-startIcon': {
                                            margin: 0,
                                        },
                                        '&:hover': {
                                            border: 'none',
                                            background: investigateEnabled ? '#DBEBFF' : '#F4F8FF',
                                            color: investigateEnabled ? '#0E4EDB' : '#475B79',
                                        },
                                    }}
                                    startIcon={<InvestigateIcon style={{ width: '16px', height: '16px' }} />}
                                    title={investigateEnabled ? 'Investigate on' : 'Investigate off'}
                                >
                                    Investigate
                                </Button>
                            </Box>

                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: { xs: '8px', sm: '12px' },
                                    minWidth: 0,
                                    marginLeft: { xs: 0, sm: 'auto' },
                                    pointerEvents: 'auto',
                                }}
                            >
                                <Box
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openSearchOptions();
                                    }}
                                    sx={{
                                        display: { xs: 'inline-flex', sm: 'none' },
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '10px 8px',
                                        margin: '-10px -8px',
                                        borderRadius: '0px',
                                        background: 'transparent',
                                        color: '#46566C',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        lineHeight: '16px',
                                        textTransform: 'none',
                                        minWidth: 0,
                                        maxWidth: 'calc(100% - 52px)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        pointerEvents: 'auto',
                                    }}
                                >
                                    <SearchOptionsIcon style={{ color: '#46566C', width: '16px', height: '16px' }} />
                                    {mobileChipLabel}
                                </Box>

                                <Button
                                    sx={{
                                        display: { xs: 'none', sm: 'inline-flex' },
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        height: '36px',
                                        padding: '10px 8px',
                                        margin: '-10px -8px',
                                        borderRadius: '18px',
                                        background: 'transparent',
                                        color: '#46566C',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        lineHeight: '16px',
                                        textTransform: 'none',
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        maxWidth: '280px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        pointerEvents: 'auto',
                                        '&:hover': {
                                            background: 'transparent',
                                        },
                                    }}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openSearchOptions();
                                    }}
                                >
                                    <SearchOptionsIcon style={{ color: '#46566C', width: '16px', height: '16px' }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mobileChipLabel}</span>
                                </Button>

                                <Box
                                    role="button"
                                    aria-label="Start chat"
                                    className="search-button-big"
                                    onClick={() => { navigateToLLMAgent(llmQuery.trim()); }}
                                    sx={{
                                        height: { xs: '32px', sm: '32px' },
                                        width: { xs: '32px', sm: '32px' },
                                        borderRadius: '8px',
                                        backgroundColor: llmQuery.trim() && !isQueryLimitReached ? '#155DFC' : '#D9E6FE',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'transform 120ms ease',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                        },
                                        pointerEvents: 'auto',
                                    }}
                                >
                                    <SearchArrowIcon
                                        style={{
                                            color: llmQuery.trim() && !isQueryLimitReached ? '#FFFFFF' : '#155DFC',
                                            width: '16px',
                                            height: '16px',
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <Drawer
                            anchor="bottom"
                            open={mobileOptionsOpen}
                            onClose={closeSearchOptions}
                            PaperProps={{
                                sx: {
                                    borderTopLeftRadius: '24px',
                                    borderTopRightRadius: '24px',
                                    backgroundColor: '#FFFFFF',
                                    px: 3,
                                    pb: 2,
                                    pt: 0,
                                    minHeight: '300px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                },
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                                <Box sx={{ width: '44px', height: '4px', borderRadius: '4px', backgroundColor: '#D8D8D8' }} />
                            </Box>
                            {searchOptionsPanel}
                        </Drawer>

                        <Drawer
                            anchor="right"
                            open={desktopOptionsOpen}
                            onClose={closeSearchOptions}
                            ModalProps={{
                                keepMounted: true,
                            }}
                            PaperProps={{
                                sx: {
                                    width: '369px',
                                    maxWidth: '92vw',
                                    backgroundColor: '#FFFFFF',
                                    px: 3,
                                    pb: 3,
                                    pt: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                },
                            }}
                        >
                            {searchOptionsPanel}
                        </Drawer>
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
                            fontFamily: 'Geist, sans-serif',
                            fontSize: '16px',
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
                        trackGtagEvent('home_search_submit_enter', {
                            ranking_mode: buildSearchOptionsPayload().rankingMode,
                        });
                        navigateToLLMAgent(llmQuery.trim());
                    }
                }}
            />

        </Box>
    );
});

export default LlmSearchBar;
