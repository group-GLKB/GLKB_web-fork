import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  Autocomplete,
  Box,
  Button,
  Drawer,
  Menu,
  MenuItem,
  Paper,
  Popper,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { useAuth } from '../Auth/AuthContext';
import { INVESTIGATE_ENABLED, LITERATURE_REVIEW_ENABLED } from '../../config/features';
import { CHAT_NEW_PATH } from '../../config/entryRoutes';
import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';
import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
import { ReactComponent as SearchOptionsIcon } from '../../img/llm/search_options.svg';
import { ReactComponent as SearchOptionsCloseIcon } from '../../img/llm/search_options_close.svg';
import { ReactComponent as SearchOptionsCollapseIcon } from '../../img/llm/search_options_collapse.svg';
import { trackGtagEvent } from '../../utils/gtag';
import TierPicker from '../Units/TierPicker';
import {
    AttachButton,
    AttachmentChips,
    attachmentBlockedNote,
    dragHasFiles,
    filesFromTransfer,
    useAttachments,
} from '../Units/AttachmentChips';
import { effectiveTier, getTierPref, setTierPref } from '../../service/serviceTiers';
import {
    defaultQuestionFor,
    GUEST_ATTACH_REASON,
    INVESTIGATE_ATTACH_NOTE,
} from '../../service/attachments';

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    const [investigateEnabled, setInvestigateEnabled] = useState(false);
    /* Literature Review shares the Investigate chip: the chip toggles whichever research tool is
       selected, and its arrow picks the tool. At most one is on. Behind LITERATURE_REVIEW_ENABLED
       (config/features.js) — with the flag off none of this renders and the chip is Investigate
       exactly as before. */
    const [reviewEnabled, setReviewEnabled] = useState(false);
    const [researchTool, setResearchTool] = useState('investigate');
    const [toolMenuAnchor, setToolMenuAnchor] = useState(null);
    /* The service tier the first question will run on (service/serviceTiers.js).

       Persisted through the same helper the chat composer reads, so a choice made here is
       the choice the conversation continues with — the two pickers are one preference, not
       two that can disagree once the reader lands on /chat. */
    const [serviceTier, setServiceTier] = useState(() => getTierPref());
    const [sortBy, setSortBy] = useState('Default');
    const [paperType, setPaperType] = useState('All types');
    const [isOpen, setIsOpen] = useState(false);
    const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
    const [desktopOptionsOpen, setDesktopOptionsOpen] = useState(false);
    /* The tier menu belongs on this list for the same reason the two Search Options drawers
       do: it opens over the composer, and the example list must not be drawn underneath it.
       Stopping the chip's click (below) keeps a click at REST from opening the examples; this
       is the other half — the examples are often already open, because focusing the box opens
       them, and then the menu lands on top of a list the reader cannot use. */
    const [tierMenuOpen, setTierMenuOpen] = useState(false);
    /* A guest may ask (guest mode, 2026-10-03): Standard only, and a monthly number of
       questions. Reaching past either opens the sign-in overlay with the reason on it. */
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
    const isGuest = !authLoading && !isAuthenticated;
    const navigate = useNavigate();
    /* Images and PDFs on the first question (service/attachments.js). Uploaded as they are
       picked; the question hands their ids to the chat in its navigation state. Signed-in
       readers and AI Chat only — see the paperclip below. */
    const attachments = useAttachments({ onRequireSignIn: () => openLoginModal(GUEST_ATTACH_REASON) });
    const [isDragOver, setIsDragOver] = useState(false);
    // The app shell and HomePage both switch at 767px. A separate 600px
    // threshold mixed the mobile page with the PC search controls.
    const isMobileLayout = useMediaQuery('(max-width:767px)');
    const inputTimeoutRef = React.useRef(null);
    const hasTrackedInputRef = React.useRef(false);
    const lastPrefillRef = React.useRef(undefined);
    const queryOriginRef = React.useRef('typed');
    const isQueryLimitReached = Boolean(props.isQueryLimitReached);
    const isAgentRunActive = Boolean(props.isAgentRunActive);
    /* An answer being written somewhere else does NOT lock this box.

       It used to: New Chat during a run sends the reader here, and here they met a disabled
       field reading "A conversation is still loading" with no way forward — the same dead end
       the chat composer had, in the one place the reader was sent to escape it. A question
       asked here opens its own conversation with its own history id, and the backend locks per
       history id, so it does not race the answer already being written.

       The quota is a different matter and still locks: there is no run to start at all. */
    // A guest at the limit keeps a live box: sending opens the sign-in overlay instead.
    const isInputLocked = isQueryLimitReached && !isGuest;
    // Investigate (and Literature Review) do not read attachments.
    const attachmentsOffForMode = investigateEnabled || reviewEnabled;
    const attachmentNote = attachmentBlockedNote(attachments, { investigate: attachmentsOffForMode });
    const readyAttachments = attachments.readyAttachments;
    const canStart = (Boolean(llmQuery.trim()) || readyAttachments.length > 0)
        && !isInputLocked && !attachments.isUploading && !attachmentNote;
    const takeFiles = (files) => {
        if (!files?.length) return;
        if (isGuest) {
            openLoginModal(GUEST_ATTACH_REASON);
            return;
        }
        if (attachmentsOffForMode || isInputLocked) return;
        attachments.addFiles(files);
    };
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
            if (props.prefillQuery.trim()) queryOriginRef.current = 'example';
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
            // The tier survives this branch while filters/rankingMode do not: deep research
            // ignores the search-mode knobs but is priced, and run, by the tier.
            return {
                filters: [],
                rankingMode: 'default',
                investigateEnabled: true,
                serviceTier: effectiveTier(serviceTier, { isGuest }),
            };
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
            serviceTier: effectiveTier(serviceTier, { isGuest }),
        };
    };

    const navigateToLLMAgent = (typedQuery = '', inputMethod = 'button') => {
        // A guest who has used the month's questions is asked to sign in, question kept.
        if (isQueryLimitReached && isGuest) {
            openLoginModal(props.limitReachedText || undefined);
            return;
        }
        /* Held back while a file is still uploading, or when one failed or the mode cannot take
           them (the chips say which). A question with files and no words asks for a summary. */
        if (attachments.hasItems && (attachments.isUploading || attachmentNote)) return;
        const sentAttachments = readyAttachments;
        const query = typedQuery || (sentAttachments.length ? defaultQuestionFor(sentAttachments) : '');
        // Clear input timeout to prevent search_input event after submission
        if (inputTimeoutRef.current) {
            clearTimeout(inputTimeoutRef.current);
            hasTrackedInputRef.current = true;
        }
        if (LITERATURE_REVIEW_ENABLED && reviewEnabled && query) {
            // A pipeline of its own, with a page of its own: nothing of the chat page's state
            // machine is involved. See components/LiteratureReview.
            trackGtagEvent('literature_review_question_submit', { source: 'home_searchbar' });
            navigate('/literature-review', { state: { initialQuery: query } });
            return;
        }
        const searchOptions = buildSearchOptionsPayload();
        if (sentAttachments.length && !searchOptions.investigateEnabled) {
            searchOptions.attachments = sentAttachments;
        }
        const queryMethod = queryOriginRef.current === 'example' ? 'example' : inputMethod;
        trackGtagEvent('home_search_submit_click', {
            has_query: Boolean(query),
            ranking_mode: searchOptions.rankingMode,
            filters: searchOptions.filters.join(','),
            investigate_enabled: searchOptions.investigateEnabled,
        });
        if (query && searchOptions.investigateEnabled) {
            trackGtagEvent('investigate_question_submit', {
                source: 'home_searchbar',
                input_method: queryMethod,
                queued: false,
            });
        }
        if (query) {
            navigate(CHAT_NEW_PATH, {
                state: {
                    initialQuery: query,
                    initialSearchOptions: searchOptions,
                    initialQueryMethod: queryMethod,
                },
            });
            // The files are the question's now; the chat sends their ids with it.
            if (sentAttachments.length) attachments.clear();
        } else {
            navigate(CHAT_NEW_PATH, {
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
    const searchOptionsLocked = investigateEnabled || reviewEnabled;
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

    const searchOptionsPanel = (
        <div className="home-search-options-panel">
            <header className="home-search-options-header">
                <h2>Search Options</h2>
                <button type="button" aria-label="Close search options" onClick={closeSearchOptions}>
                    <SearchOptionsCloseIcon />
                </button>
            </header>

            <section className="home-search-options-section is-article-type">
                <div className="home-search-options-section-heading">
                    <h3>Article Type</h3>
                    <span className="home-search-options-collapse" aria-hidden="true">
                        <SearchOptionsCollapseIcon />
                    </span>
                </div>
                <div className="home-search-options-segmented is-article-type">
                    {paperTypeOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={option.value === paperType}
                            className={option.value === paperType ? 'is-active' : ''}
                            onClick={() => {
                                trackGtagEvent('home_article_type_select_click', { value: option.value });
                                setPaperType(option.value);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <p>Search every article</p>
            </section>

            <div className="home-search-options-divider" />

            <section className="home-search-options-section is-sort-by">
                <div className="home-search-options-section-heading">
                    <h3>Sort by</h3>
                    <span className="home-search-options-collapse" aria-hidden="true">
                        <SearchOptionsCollapseIcon />
                    </span>
                </div>
                <div className="home-search-options-segmented is-sort-by">
                    {sortOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={option.value === sortBy}
                            className={option.value === sortBy ? 'is-active' : ''}
                            onClick={() => {
                                trackGtagEvent('home_sort_mode_select_click', { value: option.value });
                                setSortBy(option.value);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <p>Best matches for your query</p>
            </section>

            <footer className="home-search-options-footer">
                <div>
                    <button type="button" className="home-search-options-reset" onClick={handleResetSearchOptions}>Reset</button>
                    <button type="button" className="home-search-options-done" onClick={closeSearchOptions}>Done</button>
                </div>
            </footer>
        </div>
    );

    return (
        <Box
            className={`llm-searchbar${isDragOver ? ' attachment-drop-target' : ''}`}
            onDragOver={(event) => {
                if (!dragHasFiles(event)) return;
                event.preventDefault();
                if (!isDragOver) setIsDragOver(true);
            }}
            onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setIsDragOver(false);
            }}
            onDrop={(event) => {
                if (!dragHasFiles(event)) return;
                event.preventDefault();
                setIsDragOver(false);
                takeFiles(filesFromTransfer(event.dataTransfer));
            }}
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
                open={!mobileOptionsOpen && !desktopOptionsOpen && !tierMenuOpen && isOpen}
                disabled={isInputLocked}
                options={props.autocompleteOptions || []}
                filterOptions={(options) => (llmQuery?.trim() === '' ? options : [])}
                onChange={(event, newValue) => {
                    if (isInputLocked) return;
                    if (newValue) queryOriginRef.current = 'example';
                    setLlmQuery(newValue || '');
                }}
                onInputChange={(event, newInputValue, reason) => {
                    if (isInputLocked) return;
                    if (reason === 'input') queryOriginRef.current = 'typed';
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
                        <AttachmentChips
                            items={attachments.items}
                            notice={attachments.notice}
                            blockedNote={attachmentNote}
                            onRemove={attachments.remove}
                        />
                        <TextField
                            {...params}
                            onPaste={(event) => {
                                // Only a paste that carries files is taken over.
                                const files = filesFromTransfer(event.clipboardData);
                                if (!files.length) return;
                                event.preventDefault();
                                takeFiles(files);
                            }}
                            /* Figma 800:22889 shortens this on a phone, where the
                               long form wraps to two lines. */
                            placeholder={isAgentRunActive
                                ? (isMobileLayout
                                    ? 'Ask something new\u2026'
                                    : 'Ask a new question \u2014 the other answer keeps writing')
                                : (isMobileLayout
                                    ? 'Ask about the biomedical literature...'
                                    : 'Ask a question about the biomedical literature...')}
                            multiline
                            minRows={1}
                            maxRows={9}
                            disabled={isInputLocked}
                            sx={{
                                minHeight: isMobileLayout ? '148px' : '120px',
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    borderRadius: '16px',
                                    minHeight: isMobileLayout ? '148px' : '120px',
                                    backgroundColor: 'var(--color-background-subtle)',
                                    alignItems: 'flex-start',
                                    paddingLeft: '20px',
                                    paddingRight: '20px !important',
                                    paddingTop: isMobileLayout ? '16.5px' : '20px',
                                    paddingBottom: isMobileLayout ? '58px' : '52px',
                                    fontFamily: 'Geist, sans-serif',
                                    fontSize: '14px',
                                    color: 'var(--color-text-primary)',
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    lineHeight: '22px',
                                    padding: '0 !important',
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: 'var(--color-text-tertiary)',
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
                            {(INVESTIGATE_ENABLED || LITERATURE_REVIEW_ENABLED) && (
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: isMobileLayout ? '8px' : '12px',
                                    minWidth: 0,
                                    pointerEvents: 'auto',
                                }}
                            >
                                {INVESTIGATE_ENABLED && !LITERATURE_REVIEW_ENABLED && (
                                <Button
                                    disabled={isInputLocked}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const next = !investigateEnabled;
                                        if (next) {
                                            trackGtagEvent('home_investigate_enable_click', {
                                                source: 'home_searchbar',
                                            });
                                        }
                                        trackGtagEvent('home_investigate_toggle_click', {
                                            enabled: next,
                                        });
                                        setInvestigateEnabled(next);
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
                                )}
                                {LITERATURE_REVIEW_ENABLED && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                    {(() => {
                                        const reviewSelected = researchTool === 'literature_review';
                                        const active = reviewSelected ? reviewEnabled : investigateEnabled;
                                        const chipSx = {
                                            height: '32px',
                                            border: 'none',
                                            background: active ? 'var(--color-brand-muted)' : 'transparent',
                                            color: active ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
                                            fontFamily: 'Geist, sans-serif',
                                            fontWeight: 600,
                                            fontSize: '12px',
                                            lineHeight: '16px',
                                            textTransform: 'none',
                                            minWidth: 0,
                                            whiteSpace: 'nowrap',
                                            boxShadow: 'none !important',
                                            '& .MuiButton-startIcon, & .MuiButton-endIcon': { margin: 0 },
                                            '&:hover': {
                                                border: 'none',
                                                background: active ? 'var(--color-blue-200)' : 'var(--color-background-subtle)',
                                                color: active ? 'var(--color-blue-600)' : 'var(--color-grey-600)',
                                            },
                                        };
                                        const stop = (event) => { event.preventDefault(); event.stopPropagation(); };
                                        const toggle = (event) => {
                                            stop(event);
                                            if (reviewSelected) {
                                                setInvestigateEnabled(false);
                                                setReviewEnabled(!reviewEnabled);
                                            } else {
                                                const next = !investigateEnabled;
                                                trackGtagEvent('home_investigate_toggle_click', { enabled: next });
                                                setReviewEnabled(false);
                                                setInvestigateEnabled(next);
                                            }
                                        };
                                        const choose = (tool) => {
                                            setToolMenuAnchor(null);
                                            setResearchTool(tool);
                                            setInvestigateEnabled(tool === 'investigate');
                                            setReviewEnabled(tool === 'literature_review');
                                        };
                                        return (
                                            <>
                                                <Button
                                                    disabled={isInputLocked}
                                                    onMouseDown={stop}
                                                    onClick={toggle}
                                                    sx={{ ...chipSx, gap: '4px', padding: '4px 4px 4px 8px', borderRadius: '8px 0 0 8px' }}
                                                    startIcon={reviewSelected
                                                        ? <MenuBookIcon style={{ width: '18px', height: '18px' }} />
                                                        : <InvestigateIcon style={{ width: '20px', height: '20px' }} />}
                                                    endIcon={active ? <CloseIcon style={{ width: '16px', height: '16px' }} /> : null}
                                                    title={`${reviewSelected ? 'Literature Review' : 'Investigate'} ${active ? 'on' : 'off'}`}
                                                >
                                                    {reviewSelected ? 'Literature Review' : 'Investigate'}
                                                </Button>
                                                <Button
                                                    disabled={isInputLocked}
                                                    aria-label="Choose research tool"
                                                    aria-haspopup="menu"
                                                    onMouseDown={stop}
                                                    onClick={(event) => { stop(event); setToolMenuAnchor(event.currentTarget); }}
                                                    sx={{ ...chipSx, padding: '4px 2px', borderRadius: '0 8px 8px 0' }}
                                                >
                                                    <ArrowDropDownIcon style={{ width: '18px', height: '18px' }} />
                                                </Button>
                                                <Menu
                                                    anchorEl={toolMenuAnchor}
                                                    open={Boolean(toolMenuAnchor)}
                                                    onClose={() => setToolMenuAnchor(null)}
                                                >
                                                    {INVESTIGATE_ENABLED && (
                                                        <MenuItem
                                                            selected={researchTool === 'investigate'}
                                                            onClick={() => choose('investigate')}
                                                        >
                                                            <InvestigateIcon style={{ width: '18px', height: '18px', marginRight: 8 }} />
                                                            Investigate
                                                        </MenuItem>
                                                    )}
                                                    <MenuItem
                                                        selected={researchTool === 'literature_review'}
                                                        onClick={() => choose('literature_review')}
                                                    >
                                                        <MenuBookIcon style={{ width: '18px', height: '18px', marginRight: 8 }} />
                                                        Literature Review
                                                    </MenuItem>
                                                </Menu>
                                            </>
                                        );
                                    })()}
                                </Box>
                                )}
                            </Box>
                            )}

                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: isMobileLayout ? '8px' : '16px',
                                    minWidth: 0,
                                    // With Investigate hidden this is the row's only child, so
                                    // `space-between` alone would park it on the left.
                                    marginLeft: isMobileLayout && (INVESTIGATE_ENABLED || LITERATURE_REVIEW_ENABLED) ? 0 : 'auto',
                                    pointerEvents: 'auto',
                                }}
                            >
                                {/* Beside Search Options, and NOT behind `searchOptionsLocked`
                                    with it: Investigate withdraws the search-mode controls
                                    because deep research discards filters and ranking, but it
                                    is priced and run by the tier — so this one stays offered.

                                    Wrapped in the same click guard the other controls in this
                                    row carry. The row sits inside the Autocomplete, whose root
                                    focuses the input on any click it sees, and `openOnFocus`
                                    then drops the example list open — so opening the tier
                                    menu also popped the examples open underneath it, over the
                                    very menu the reader was aiming at. `preventDefault` on
                                    mousedown is what keeps the focus from moving; stopping the
                                    click is what keeps the Autocomplete from opening. */}
                                <Box
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                    // Never squeezed: the model chip does not shrink, so a shrinking
                                    // wrapper only let it spill over Search Options on a phone.
                                    sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0, flexShrink: 0 }}
                                >
                                <AttachButton
                                    onFiles={takeFiles}
                                    isGuest={isGuest}
                                    onRequireSignIn={() => openLoginModal(GUEST_ATTACH_REASON)}
                                    disabled={attachmentsOffForMode || isInputLocked}
                                    disabledReason={attachmentsOffForMode ? INVESTIGATE_ATTACH_NOTE : ''}
                                    source="home_searchbar"
                                />
                                <TierPicker
                                    value={serviceTier}
                                    onChange={(tierId) => {
                                        setServiceTier(tierId);
                                        setTierPref(tierId);
                                    }}
                                    onResolveDefault={setServiceTier}
                                    // Toggling Investigate re-prices the list (an Investigate
                                    // query costs more per tier).
                                    pipeline={investigateEnabled ? 'deep_research' : 'chat'}
                                    onOpenChange={setTierMenuOpen}
                                    disabled={isInputLocked}
                                    isGuest={isGuest}
                                    onRequireSignIn={(tier) => openLoginModal(
                                        `${tier?.label || 'GPT-6.1 Sol'} is available to signed-in users. Sign in to use it — it's free.`,
                                    )}
                                />
                                </Box>

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
                                        display: isMobileLayout ? 'inline-flex' : 'none',
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
                                    {/* On a phone the row also holds the paperclip and the model
                                        chip, so this is what gives way: the label truncates and the
                                        icon keeps its size (unshrunk, it was squeezed to nothing). */}
                                    <SearchOptionsIcon style={{ color: 'var(--color-text-tertiary)', width: '20px', height: '20px', flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mobileChipLabel}</span>
                                </Box>
                                )}

                                {!searchOptionsLocked && (
                                <Button
                                    sx={{
                                        display: isMobileLayout ? 'none' : 'inline-flex',
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
                                    aria-disabled={isInputLocked || (attachments.hasItems && !canStart)}
                                    className="search-button-big"
                                    onClick={() => { if (!isInputLocked) navigateToLLMAgent(llmQuery.trim(), 'button'); }}
                                    sx={{
                                        height: '32px',
                                        width: '32px',
                                        borderRadius: '8px',
                                        backgroundColor: canStart ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)',
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
                                            color: canStart ? 'var(--color-neutral-white)' : 'var(--color-brand-primary)',
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
                            ModalProps={{
                                BackdropProps: {
                                    sx: { backgroundColor: 'rgba(0, 0, 0, 0.32)' },
                                },
                            }}
                            PaperProps={{
                                sx: {
                                    borderTopLeftRadius: '24px',
                                    borderTopRightRadius: '24px',
                                    backgroundColor: 'var(--color-background-surface)',
                                    px: 0,
                                    pb: 0,
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
                                BackdropProps: {
                                    sx: { backgroundColor: 'rgba(0, 0, 0, 0.32)' },
                                },
                            }}
                            PaperProps={{
                                sx: {
                                    width: '363px',
                                    maxWidth: '92vw',
                                    backgroundColor: 'var(--color-background-surface)',
                                    px: 0,
                                    pb: 0,
                                    pt: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: 'none',
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
                    if (e.key === 'Enter' && !e.shiftKey
                        && (llmQuery.trim() !== "" || readyAttachments.length > 0)) {
                        e.preventDefault();
                        trackGtagEvent('home_search_submit_enter', {
                            ranking_mode: buildSearchOptionsPayload().rankingMode,
                        });
                        navigateToLLMAgent(llmQuery.trim(), 'enter');
                    }
                }}
            />

        </Box>
    );
});

export default LlmSearchBar;
