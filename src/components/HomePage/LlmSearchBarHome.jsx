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

import { INVESTIGATE_ENABLED } from '../../config/features';
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
    const isAgentRunActive = Boolean(props.isAgentRunActive);
    const isInputLocked = isQueryLimitReached || isAgentRunActive;
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
        // Investigate ignores filters / ranking_mode (see the lock comment below), and its
        // controls are not rendered, so send the defaults rather than whatever the user
        // happened to pick before turning Investigate on.
        if (investigateEnabled) {
            return { filters: [], rankingMode: 'default', investigateEnabled: true };
        }

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
        if (isAgentRunActive) return;
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
    // Deep Research runs its own hybrid retrieval instead of the agent's search tools, and drops
    // `filters` / `ranking_mode` on the floor (see harness_runner.py's warning). Offering the
    // control while Investigate is on promises filtering that never happens, so it is locked.
    // The control is hidden rather than greyed out while locked: a disabled button still reads
    // as "these settings apply, you just can't change them", which is the opposite of the truth.
    const searchOptionsLocked = investigateEnabled;
    const mobileChipLabel = (mobileSelectedOptions.length > 0)
        ? mobileSelectedOptions.join(' + ')
        : 'Search Options';

    const openSearchOptions = () => {
        if (searchOptionsLocked) return;
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

    // Turning Investigate on while the drawer is open must not leave an inert panel on screen,
    // and the selections go back to their defaults so turning Investigate off again doesn't
    // silently restore filters the user can no longer see.
    useEffect(() => {
        if (searchOptionsLocked) {
            setMobileOptionsOpen(false);
            setDesktopOptionsOpen(false);
            setPaperType(defaultPaperType);
            setSortBy(defaultSortBy);
        }
    }, [searchOptionsLocked]);

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
        backgroundColor: isActive ? 'var(--color-background-surface)' : 'transparent',
        boxShadow: isActive ? '0px 2px 2px rgba(0, 0, 0, 0.10)' : 'none',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: isActive ? 900 : 600,
        fontSize: '14px',
        lineHeight: '16px',
        color: isActive ? 'var(--color-brand-primary)' : 'var(--color-grey-600)',
        textTransform: 'none',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: isActive ? 'var(--color-background-surface)' : 'rgba(255, 255, 255, 0.35)',
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
                <Box sx={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: '20px', lineHeight: '24px', color: 'var(--color-text-secondary)' }}>
                    Search Options
                </Box>
                <IconButton onClick={closeSearchOptions} size="small" sx={{ color: 'var(--color-grey-600)' }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box sx={{ borderTop: '1px solid var(--color-border-default)', mx: '-24px' }} />

            <Box sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                <Box>
                    <Box sx={{ mb: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: '16px', lineHeight: '24px', color: 'var(--color-text-secondary)' }}>
                        Article Type
                    </Box>
                    <Box sx={{ backgroundColor: 'var(--color-background-subtle)', borderRadius: '10px', p: '4px', display: 'flex', gap: 0, justifyContent: 'space-between' }}>
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
                    <Box sx={{ mt: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: '16px', color: 'var(--color-grey-400)' }}>
                        Search every article
                    </Box>
                </Box>

                <Box sx={{ borderTop: '1px solid var(--color-border-default)', mx: '-24px' }} />

                <Box>
                    <Box sx={{ mb: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: '16px', lineHeight: '24px', color: 'var(--color-text-secondary)' }}>
                        Sort by
                    </Box>
                    <Box sx={{ backgroundColor: 'var(--color-background-subtle)', borderRadius: '10px', p: '4px', display: 'flex', gap: 0, justifyContent: 'space-between' }}>
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
                    <Box sx={{ mt: 1, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: '16px', color: 'var(--color-grey-400)' }}>
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
                        color: 'var(--color-grey-600)',
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
                        backgroundColor: 'var(--color-brand-primary)',
                        color: 'var(--color-neutral-white)',
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
                backgroundColor: 'var(--color-background-subtle)',
                borderRadius: '16px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--color-border-default)',
                boxShadow: 'none',
            }}>
            <Autocomplete
                freeSolo
                fullWidth
                open={!mobileOptionsOpen && !desktopOptionsOpen && isOpen}
                disabled={isInputLocked}
                options={props.autocompleteOptions || []}
                filterOptions={(options) => (llmQuery?.trim() === '' ? options : [])}
                onChange={(event, newValue) => {
                    if (isInputLocked) return;
                    setLlmQuery(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                    if (isInputLocked) return;
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
                    if (isInputLocked) {
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
                            /* Figma 800:22889 shortens this on a phone, where the
                               long form wraps to two lines. */
                            placeholder={isAgentRunActive
                                ? 'A conversation is still loading'
                                : (isMobileLayout
                                    ? 'Ask about the biomedical literature...'
                                    : 'Ask a question about the biomedical literature...')}
                            multiline
                            minRows={3}
                            maxRows={9}
                            disabled={isInputLocked}
                            sx={{
                                minHeight: { xs: '148px', sm: '152px' },
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    borderRadius: '16px',
                                    minHeight: { xs: '148px', sm: '152px' },
                                    backgroundColor: 'var(--color-background-subtle)',
                                    alignItems: 'flex-start',
                                    paddingLeft: '20px',
                                    paddingRight: '20px !important',
                                    paddingTop: '16.5px',
                                    paddingBottom: '58px',
                                    fontFamily: 'Geist, sans-serif',
                                    fontSize: '16px',
                                    color: 'var(--color-text-primary)',
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    lineHeight: '26px',
                                    padding: '0 !important',
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: 'var(--color-grey-300)',
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
                                left: '16px',
                                right: '16px',
                                bottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                pointerEvents: 'none',
                            }}
                        >
                            {INVESTIGATE_ENABLED && (
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
                                    disabled={isInputLocked}
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
                                        gap: '4px',
                                        height: '32px',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: investigateEnabled ? 'var(--color-brand-muted)' : 'transparent',
                                        color: investigateEnabled ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        lineHeight: '16px',
                                        textTransform: 'none',
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        boxShadow: 'none !important',
                                        transition: 'background-color 0.18s ease, color 0.18s ease',
                                        '& .MuiButton-startIcon, & .MuiButton-endIcon': {
                                            margin: 0,
                                        },
                                        '&:hover': {
                                            border: 'none',
                                            background: investigateEnabled ? 'var(--color-blue-200)' : 'var(--color-background-subtle)',
                                            color: investigateEnabled ? 'var(--color-blue-600)' : 'var(--color-grey-600)',
                                        },
                                    }}
                                    startIcon={<InvestigateIcon style={{ width: '20px', height: '20px' }} />}
                                    // The active chip carries a dismiss affordance in the design. It is
                                    // decorative here — the whole chip already toggles, so a separate
                                    // handler would just double-fire.
                                    endIcon={investigateEnabled
                                        ? <CloseIcon style={{ width: '16px', height: '16px' }} />
                                        : null}
                                    title={investigateEnabled ? 'Investigate on' : 'Investigate off'}
                                >
                                    Investigate
                                </Button>
                            </Box>
                            )}

                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: { xs: '8px', sm: '16px' },
                                    minWidth: 0,
                                    // With Investigate hidden this is the row's only child, so
                                    // `space-between` alone would park it on the left.
                                    marginLeft: { xs: INVESTIGATE_ENABLED ? 0 : 'auto', sm: 'auto' },
                                    pointerEvents: 'auto',
                                }}
                            >
                                {!searchOptionsLocked && (
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
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        color: 'var(--color-text-tertiary)',
                                        cursor: 'pointer',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '12px',
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
                                    <SearchOptionsIcon style={{ color: 'var(--color-text-tertiary)', width: '20px', height: '20px' }} />
                                    {mobileChipLabel}
                                </Box>
                                )}

                                {!searchOptionsLocked && (
                                <Button
                                    sx={{
                                        display: { xs: 'none', sm: 'inline-flex' },
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        height: '32px',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        color: 'var(--color-text-tertiary)',
                                        cursor: 'pointer',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '12px',
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
                                    <SearchOptionsIcon style={{ color: 'var(--color-text-tertiary)', width: '20px', height: '20px' }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mobileChipLabel}</span>
                                </Button>
                                )}

                                <Box
                                    role="button"
                                    aria-label="Start chat"
                                    aria-disabled={isInputLocked}
                                    className="search-button-big"
                                    onClick={() => { if (!isInputLocked) navigateToLLMAgent(llmQuery.trim()); }}
                                    sx={{
                                        height: { xs: '32px', sm: '32px' },
                                        width: { xs: '32px', sm: '32px' },
                                        borderRadius: '8px',
                                        backgroundColor: llmQuery.trim() && !isInputLocked ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: isInputLocked ? 'not-allowed' : 'pointer',
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
                                            color: llmQuery.trim() && !isInputLocked ? 'var(--color-neutral-white)' : 'var(--color-brand-primary)',
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
                                    backgroundColor: 'var(--color-background-surface)',
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
                                <Box sx={{ width: '44px', height: '4px', borderRadius: '4px', backgroundColor: 'var(--color-background-normal)' }} />
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
                                    backgroundColor: 'var(--color-background-surface)',
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
                    if (isInputLocked) {
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
