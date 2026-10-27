import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import {
  Autocomplete,
  Box,
  Paper,
  Popper,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { useAuth } from '../Auth/AuthContext';
import { INVESTIGATE_ENABLED, LITERATURE_REVIEW_ENABLED } from '../../config/features';
import { CHAT_NEW_PATH } from '../../config/entryRoutes';
import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
import { trackGtagEvent } from '../../utils/gtag';
import TierPicker from '../Units/TierPicker';
import EffortPicker, { chooseEffort, EffortLevels } from '../Units/EffortPicker';
import ComposerOptions, {
    answerFlags,
    DEFAULT_COMPOSER_OPTIONS,
    OptionsButton,
    optionsChanged,
    searchFilters,
} from '../Units/ComposerOptions';
import {
    AttachButton,
    AttachConflict,
    AttachmentChips,
    attachmentBlockedNote,
    dragHasFiles,
    filesFromTransfer,
    useAttachments,
} from '../Units/AttachmentChips';
import { effectiveTier, getTierPref, setTierPref } from '../../service/serviceTiers';
import {
    DEFAULT_EFFORT,
    EFFORT_EXTRA,
    effortLabel,
    effortLevel,
    getEffortPref,
    isDeepEffort,
    setEffortPref,
    subscribeToEffortPref,
} from '../../service/effortLevels';
import { GUEST_INVESTIGATE_REASON, GUEST_REVIEW_REASON } from '../../utils/refusals';
import ComposerModes, { COMPOSER_MODES, ModePill, ModeSheet } from './ComposerModes';
import ReviewScope, { initialScope } from './ReviewScope';
import { setStylePref } from '../LiteratureReview/citationStyle';
import {
    defaultQuestionFor,
    GUEST_ATTACH_REASON,
    MAX_FILES_PER_MESSAGE,
    PAPER_ACCEPT,
    PAPER_FORMATS_TEXT,
    pastedAttachments,
    REVIEW_PAPER_LIMITS,
} from '../../service/attachments';

// On Literature Review the composer's "+" adds the reader's own papers (Sources says how they are used).
const REVIEW_ATTACH = {
    label: 'Add your papers',
    itemLabel: 'Add your papers',
    itemHint: PAPER_FORMATS_TEXT,
    accept: PAPER_ACCEPT,
};

const MODE_SHEET_SEEN_KEY = 'glkb-mode-sheet-seen-v1';

// The room the "Extra doesn't read attached files" row takes above the control row.
const CONFLICT_ROW = 46;

const LlmSearchBar = React.forwardRef((props, ref) => {
    const [llmQuery, setLlmQuery] = useState('');
    /* The composer's mode: Chat or Literature Review, picked on the tabs along its top edge
       (ComposerModes). Literature Review exists only behind its flag (config/features.js).
       Investigate is no longer a mode (2026-10-27, design GLKB Effort A): it is the chat's
       Extra effort, picked in the model-and-effort menu. */
    const [mode, setMode] = useState('chat');
    /* How hard the chat works on the question (service/effortLevels.js): Medium runs the chat
       agent, Extra deep research. One preference with the chat page's composer. */
    const [effort, setEffort] = useState(() => getEffortPref());
    useEffect(() => subscribeToEffortPref(setEffort), []);
    const changeEffort = (next) => {
        setEffort(next);
        setEffortPref(next);
    };
    /* On a phone the modes are picked in a bottom sheet from the pill in the composer's row. Its
       dot says there is more than Chat, until the reader has opened the sheet once. */
    const [modeSheetOpen, setModeSheetOpen] = useState(false);
    const [modeSheetSeen, setModeSheetSeen] = useState(() => {
        try { return window.localStorage.getItem(MODE_SHEET_SEEN_KEY) === '1'; } catch { return false; }
    });
    const reviewEnabled = LITERATURE_REVIEW_ENABLED && mode === 'review';
    const investigateEnabled = INVESTIGATE_ENABLED && !reviewEnabled && isDeepEffort(effort);
    const modes = ['chat', LITERATURE_REVIEW_ENABLED && 'review'].filter(Boolean);
    const hasModeTabs = modes.length > 1;
    // A review's scope and model, handed to the Literature Review page with the topic.
    const [reviewScope, setReviewScope] = useState(initialScope);
    /* The service tier the first question will run on (service/serviceTiers.js).

       Persisted through the same helper the chat composer reads, so a choice made here is
       the choice the conversation continues with — the two pickers are one preference, not
       two that can disagree once the reader lands on /chat. */
    const [serviceTier, setServiceTier] = useState(() => getTierPref());
    /* The Options drawer's choices (Units/ComposerOptions): Knowledge Graph and Figures
       (Off / Auto / On), article type and sort. */
    const [composerOptions, setComposerOptions] = useState(DEFAULT_COMPOSER_OPTIONS);
    const [isOpen, setIsOpen] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    /* The tier menu belongs on this list for the same reason the two Search Options drawers
       do: it opens over the composer, and the example list must not be drawn underneath it.
       Stopping the chip's click (below) keeps a click at REST from opening the examples; this
       is the other half — the examples are often already open, because focusing the box opens
       them, and then the menu lands on top of a list the reader cannot use. */
    const [tierMenuOpen, setTierMenuOpen] = useState(false);
    /* A guest may ask (guest mode, 2026-10-03): Chat at Medium effort on GPT-6.1 Terra or GPT-6
       Luna, 10 credits in all; Extra and Literature Review need an account. Reaching past any of
       it opens the sign-in overlay with the reason on it. */
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
    const isGuest = !authLoading && !isAuthenticated;
    const navigate = useNavigate();

    /* Picking a mode. A guest has Chat only (2026-10-09): the Literature Review tab opens the
       sign-in overlay with its reason and the mode stays Chat. "investigate", which a prefill
       may still ask for, is Chat at Extra effort. */
    const changeMode = (next) => {
        if (next === 'investigate') {
            if (isGuest) { openLoginModal(GUEST_INVESTIGATE_REASON); return; }
            trackGtagEvent('home_investigate_enable_click', { source: 'home_searchbar' });
            changeEffort(EFFORT_EXTRA);
            if (mode !== 'chat') setMode('chat');
            return;
        }
        if (next === mode) return;
        if (isGuest && next === 'review') { openLoginModal(GUEST_REVIEW_REASON); return; }
        trackGtagEvent('home_composer_mode_click', { mode: next });
        setMode(next);
    };
    const { onModeChange } = props;
    // The page shows each mode's examples under the box; Chat at Extra gets Investigate's.
    useEffect(() => {
        onModeChange?.(investigateEnabled ? 'investigate' : mode);
    }, [mode, investigateEnabled, onModeChange]);
    // A prefill from outside (the news strip's "Try it") can ask for a mode too.
    useEffect(() => {
        const requested = props.requestedMode?.mode;
        if (requested && (modes.includes(requested) || (requested === 'investigate' && INVESTIGATE_ENABLED))) {
            changeMode(requested);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.requestedMode]);
    /* Images and PDFs on the first question (service/attachments.js). Uploaded as they are
       picked; the question hands their ids to the chat in its navigation state. Signed-in
       readers only. Extra effort (deep research) does not read them: the composer says so and
       offers Medium or removing them. On Literature Review the files are the reader's own papers
       (documents only, up to 50), handed to the review page. */
    const attachments = useAttachments({
        onRequireSignIn: () => openLoginModal(GUEST_ATTACH_REASON),
        limits: reviewEnabled ? REVIEW_PAPER_LIMITS : undefined,
    });
    const [isDragOver, setIsDragOver] = useState(false);
    // The app shell and HomePage both switch at 767px. A separate 600px
    // threshold mixed the mobile page with the PC search controls.
    const isMobileLayout = useMediaQuery('(max-width:767px)');
    // Literature Review says what the button does (shorter on a phone); Chat keeps the bare arrow.
    const modeAction = (isMobileLayout ? COMPOSER_MODES[mode]?.mobileAction : COMPOSER_MODES[mode]?.action) || '';
    /* The review's scope chips sit in the composer on a wide screen only: on a phone the review
       page's "Set up your review" is where they are set (the phone design), so the box keeps its size. */
    const scopeInComposer = reviewEnabled && !isMobileLayout;
    // The review scope row sits between the topic and the control row, so the box grows by it:
    // by its measured height (its chips wrap to more rows on a phone, or with longer values),
    // estimated until it has been measured.
    const paperCount = reviewEnabled ? attachments.readyAttachments.length : 0;
    const [scopeEl, setScopeEl] = useState(null);
    const [scopeHeight, setScopeHeight] = useState(0);
    useEffect(() => {
        if (!scopeEl || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => setScopeHeight(Math.ceil(scopeEl.offsetHeight)));
        observer.observe(scopeEl);
        return () => observer.disconnect();
    }, [scopeEl]);
    const scopeRows = scopeHeight ? scopeHeight + 8 : (isMobileLayout ? 96 : 52);
    const composerMinHeight = `${(isMobileLayout ? 148 : 120) + (scopeInComposer ? scopeRows : 0)}px`;
    const inputTimeoutRef = React.useRef(null);
    // The composer's box: the model-and-effort menu hangs off its lower edge.
    const composerBoxRef = React.useRef(null);
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
    // Extra does not read attachments (AttachConflict says so); Literature Review reads them as
    // the reader's papers.
    const attachConflict = investigateEnabled && attachments.hasItems;
    const attachmentNote = attachmentBlockedNote(attachments, {
        review: reviewEnabled,
        maxFiles: reviewEnabled ? REVIEW_PAPER_LIMITS.maxFiles : MAX_FILES_PER_MESSAGE,
    });
    const readyAttachments = attachments.readyAttachments;
    // A review needs its topic in words; its papers are what it reads, not a question.
    const canStart = (Boolean(llmQuery.trim()) || (!reviewEnabled && readyAttachments.length > 0))
        && !isInputLocked && !attachments.isUploading && !attachmentNote && !attachConflict;
    const takeFiles = (files) => {
        if (!files?.length) return;
        if (isGuest) {
            openLoginModal(GUEST_ATTACH_REASON);
            return;
        }
        if (isInputLocked) return;
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
        // Extra (deep research) ignores filters / ranking_mode and does figures and the graph on
        // its own, so it is sent the defaults; the tier survives: it is priced, and run, by it.
        if (investigateEnabled) {
            return {
                filters: [],
                rankingMode: 'default',
                investigateEnabled: true,
                serviceTier: effectiveTier(serviceTier, { isGuest }),
            };
        }
        return {
            ...searchFilters(composerOptions),
            investigateEnabled,
            serviceTier: effectiveTier(serviceTier, { isGuest }),
            // Only when on, so a request that asks for neither is the request it always was.
            ...answerFlags(composerOptions, effort),
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
        if (attachments.hasItems && (attachments.isUploading || attachmentNote || attachConflict)) return;
        const sentAttachments = readyAttachments;
        const query = typedQuery
            || (sentAttachments.length && !reviewEnabled ? defaultQuestionFor(sentAttachments) : '');
        // A review's papers wait for its topic: going on without one would open an empty chat
        // and leave them behind.
        if (reviewEnabled && !query && attachments.hasItems) return;
        // Clear input timeout to prevent search_input event after submission
        if (inputTimeoutRef.current) {
            clearTimeout(inputTimeoutRef.current);
            hasTrackedInputRef.current = true;
        }
        if (LITERATURE_REVIEW_ENABLED && reviewEnabled && query) {
            // A pipeline of its own, with a page of its own: nothing of the chat page's state
            // machine is involved. See components/LiteratureReview.
            trackGtagEvent('literature_review_question_submit', { source: 'home_searchbar' });
            navigate('/literature-review', {
                state: {
                    initialQuery: query,
                    scope: reviewScope,
                    serviceTier: effectiveTier(serviceTier, { isGuest }),
                    // The papers are uploaded already; the review page shows them and sends their ids.
                    papers: sentAttachments,
                },
            });
            if (sentAttachments.length) attachments.clear();
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
    const optionsDot = optionsChanged(composerOptions);
    // Literature Review has no tools or filters; on a phone its sheet still holds the model.
    const optionsForChat = !reviewEnabled;

    const openSearchOptions = () => {
        if (!optionsForChat && !isMobileLayout) return;
        trackGtagEvent('home_search_options_open_click', {
            source: isMobileLayout ? 'mobile' : 'desktop',
        });
        setIsOpen(false);
        props.setExamplesOpen?.(false);
        props.onCollapseExampleLists?.();
        setOptionsOpen(true);
    };

    const openModeSheet = () => {
        trackGtagEvent('home_mode_sheet_open_click', { mode });
        setIsOpen(false);
        props.onCollapseExampleLists?.();
        setModeSheetOpen(true);
        if (!modeSheetSeen) {
            setModeSheetSeen(true);
            try { window.localStorage.setItem(MODE_SHEET_SEEN_KEY, '1'); } catch { /* this visit only */ }
        }
    };

    const closeSearchOptions = () => {
        trackGtagEvent('home_search_options_close_click', {
            source: isMobileLayout ? 'mobile' : 'desktop',
        });
        setOptionsOpen(false);
    };

    const requireSignIn = (kind, entry) => {
        setOptionsOpen(false);
        if (kind === 'effort') {
            openLoginModal(GUEST_INVESTIGATE_REASON);
            return;
        }
        openLoginModal(
            `${entry?.label || 'GPT-6.1 Sol'} is available to signed-in users. Sign in to use it — it's free.`,
        );
    };

    // Picked in the menu. Entering Extra is tracked as entering Investigate always was.
    const pickEffort = (next) => {
        if (isDeepEffort(next)) trackGtagEvent('home_investigate_enable_click', { source: 'home_searchbar' });
        changeEffort(next);
    };

    const changeTier = (tierId) => {
        setServiceTier(tierId);
        setTierPref(tierId);
    };

    const tierPicker = (variant) => (
        <TierPicker
            variant={variant}
            value={serviceTier}
            onChange={changeTier}
            onResolveDefault={setServiceTier}
            // Each pipeline has its own prices: a review, a chat, an Extra (deep research) one.
            pipeline={reviewEnabled ? 'literature_review'
                : investigateEnabled ? 'deep_research' : 'chat'}
            onOpenChange={setTierMenuOpen}
            disabled={isInputLocked}
            isGuest={isGuest}
            onRequireSignIn={(tier) => requireSignIn('model', tier)}
        />
    );

    // The phone's sheet carries the model (and in Chat the effort): its row has no room for the chip.
    const phoneOptionsHead = isMobileLayout ? (
        <>
            <div className="composer-options-group-title">Model</div>
            <div className="composer-options-group">{tierPicker('list')}</div>
            {optionsForChat && INVESTIGATE_ENABLED && (<>
                <div className="composer-options-group-title">Effort</div>
                <div className="composer-options-group effort-sheet-levels">
                    <EffortLevels
                        effort={effort}
                        isGuest={isGuest}
                        hasFiles={attachments.hasItems}
                        onPick={(level) => chooseEffort({
                            level, effort, isGuest, onEffortChange: pickEffort, onRequireSignIn: requireSignIn,
                        })}
                    />
                </div>
            </>)}
        </>
    ) : null;

    return (
        <Box
            ref={composerBoxRef}
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
                open={!optionsOpen && !tierMenuOpen && !modeSheetOpen && isOpen}
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
                    // The "+" panel opens under this box (field and control row), as ChatGPT's does.
                    <Box data-attach-anchor sx={{ position: 'relative', width: '100%' }}>
                        {/* On a phone the mode is the pill in the bottom row instead (ModePill). */}
                        {hasModeTabs && !isMobileLayout && (
                            <ComposerModes
                                modes={modes}
                                mode={mode}
                                onChange={changeMode}
                                disabled={isInputLocked}
                                duration={mode === 'chat' ? effortLevel(effort)?.time : undefined}
                            />
                        )}
                        <AttachmentChips
                            variant="design"
                            items={attachments.items}
                            notice={attachments.notice}
                            blockedNote={attachmentNote}
                            onRemove={attachments.remove}
                        />
                        <TextField
                            {...params}
                            onPaste={(event) => {
                                /* Files of any type attach; a very long text becomes "Pasted
                                   text.txt" (as in Claude) where a file could be attached. */
                                const files = pastedAttachments(event.clipboardData, {
                                    longText: !isGuest && !isInputLocked,
                                });
                                if (!files.length) return;
                                event.preventDefault();
                                takeFiles(files);
                            }}
                            /* Figma 800:22889 shortens this on a phone, where the
                               long form wraps to two lines. */
                            placeholder={isAgentRunActive && mode === 'chat'
                                ? (isMobileLayout
                                    ? 'Ask something new\u2026'
                                    : 'Ask a new question \u2014 the other answer keeps writing')
                                : (isMobileLayout
                                    ? COMPOSER_MODES[mode].mobilePlaceholder
                                    : COMPOSER_MODES[mode].placeholder)}
                            multiline
                            minRows={1}
                            maxRows={9}
                            disabled={isInputLocked}
                            sx={{
                                minHeight: composerMinHeight,
                                width: '100%',
                                '& .MuiInputBase-root': {
                                    borderRadius: '16px',
                                    minHeight: composerMinHeight,
                                    backgroundColor: 'var(--color-background-subtle)',
                                    alignItems: 'flex-start',
                                    paddingLeft: '20px',
                                    paddingRight: '20px !important',
                                    paddingTop: hasModeTabs && !isMobileLayout ? '8px' : (isMobileLayout ? '18px' : '20px'),
                                    paddingBottom: (isMobileLayout ? 64 : 52) + (scopeInComposer ? scopeRows : 0)
                                        + (attachConflict ? CONFLICT_ROW : 0) + 'px',
                                    fontFamily: 'Geist, sans-serif',
                                    // 16px on a phone: below it iOS zooms the page in on focus.
                                    fontSize: isMobileLayout ? '16px' : '14px',
                                    color: 'var(--color-text-primary)',
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    lineHeight: isMobileLayout ? '24px' : '22px',
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

                        {scopeInComposer && (
                            <div className="review-scope-wrap" ref={setScopeEl}>
                                <ReviewScope scope={reviewScope}
                                             paperCount={paperCount}
                                             onAddPapers={isGuest ? undefined : takeFiles}
                                             onChange={(next) => {
                                    if (next.citationStyle !== reviewScope.citationStyle) setStylePref(next.citationStyle);
                                    setReviewScope(next);
                                }} />
                            </div>
                        )}
                        {attachConflict && (
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: (isMobileLayout ? 60 : 56) + 'px',
                            }}>
                                <AttachConflict
                                    effortName={effortLabel(effort)}
                                    fallbackName={effortLabel(DEFAULT_EFFORT)}
                                    count={attachments.items.length}
                                    onUseFallback={() => changeEffort(DEFAULT_EFFORT)}
                                    onRemoveFiles={() => attachments.clear()}
                                />
                            </Box>
                        )}
                        <Box
                            sx={{
                                position: 'absolute',
                                left: isMobileLayout ? '8px' : '16px',
                                right: isMobileLayout ? '8px' : '16px',
                                bottom: isMobileLayout ? '12px' : '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                // A phone's row is tight: "+ · Literature Review ▾ · options · Start →".
                                gap: isMobileLayout ? '6px' : 2,
                                pointerEvents: 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: isMobileLayout ? '4px' : '8px',
                                    minWidth: 0,
                                    pointerEvents: 'auto',
                                }}
                            >
                                {/* The "+" leads the row, as in ChatGPT. Same click guard as the
                                    row's other controls (see the tier picker's note below). */}
                                <Box
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                    sx={{ display: 'inline-flex', flexShrink: 0 }}
                                >
                                    <AttachButton
                                        variant="square"
                                        onFiles={takeFiles}
                                        {...(reviewEnabled ? REVIEW_ATTACH : { label: 'Attach PDF, figure or spreadsheet' })}
                                        isGuest={isGuest}
                                        onRequireSignIn={() => openLoginModal(GUEST_ATTACH_REASON)}
                                        disabled={isInputLocked}
                                        source="home_searchbar"
                                    />
                                </Box>
                                {hasModeTabs && isMobileLayout && (
                                    <ModePill
                                        mode={mode}
                                        onOpen={openModeSheet}
                                        disabled={isInputLocked}
                                        showDot={!modeSheetSeen && mode === 'chat'}
                                    />
                                )}
                            </Box>

                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: isMobileLayout ? '6px' : '16px',
                                    minWidth: 0,
                                    // With Investigate hidden this is the row's only child, so
                                    // `space-between` alone would park it on the left.
                                    marginLeft: isMobileLayout ? 0 : 'auto',
                                    pointerEvents: 'auto',
                                }}
                            >
                                {/* The model-and-effort chip (Chat) or the model chip (Literature Review),
                                    then Options. Wrapped in a click guard: the row sits inside the
                                    Autocomplete, whose root focuses the input on any click it sees,
                                    and `openOnFocus` then drops the example list open over the very
                                    menu the reader was aiming at. `preventDefault` on mousedown keeps
                                    the focus where it is; stopping the click keeps the Autocomplete
                                    shut. On a phone both live in the Options sheet (no room). */}
                                <Box
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                    sx={{ display: isMobileLayout ? 'none' : 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 0 }}
                                >
                                    {!isMobileLayout && (optionsForChat ? (
                                        <EffortPicker
                                            tier={serviceTier}
                                            onTierChange={changeTier}
                                            onTierResolveDefault={setServiceTier}
                                            effort={effort}
                                            onEffortChange={pickEffort}
                                            isGuest={isGuest}
                                            onRequireSignIn={requireSignIn}
                                            hasFiles={attachments.hasItems}
                                            placement="down"
                                            anchorRef={composerBoxRef}
                                            disabled={isInputLocked}
                                            onOpenChange={setTierMenuOpen}
                                        />
                                    ) : tierPicker())}
                                    {optionsForChat && !isMobileLayout && (
                                        <OptionsButton
                                            open={optionsOpen}
                                            changed={optionsDot}
                                            onClick={openSearchOptions}
                                        />
                                    )}
                                </Box>

                                {/* The phone's Options: an icon alone, opening the sheet that holds the
                                    model, the effort and the tools. */}
                                {isMobileLayout && (
                                    <OptionsButton
                                        compact
                                        open={optionsOpen}
                                        changed={optionsForChat && optionsDot}
                                        onClick={openSearchOptions}
                                    />
                                )}

                                <Box
                                    role="button"
                                    aria-label="Start chat"
                                    // Nothing typed (and, in chat, nothing attached): nothing to start, in every mode.
                                    aria-disabled={!canStart}
                                    className={`search-button-big${modeAction ? ' has-label' : ''}`}
                                    onClick={() => { if (canStart) navigateToLLMAgent(llmQuery.trim(), 'button'); }}
                                    sx={{
                                        height: isMobileLayout ? '40px' : (modeAction ? '36px' : '32px'),
                                        width: modeAction ? 'auto' : (isMobileLayout ? '40px' : '32px'),
                                        padding: modeAction ? (isMobileLayout ? '0 10px' : '0 16px') : 0,
                                        gap: isMobileLayout ? '6px' : '8px',
                                        color: canStart ? 'var(--color-neutral-white)' : 'var(--color-brand-primary)',
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '15px',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        borderRadius: isMobileLayout ? '10px' : '8px',
                                        backgroundColor: canStart ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: canStart ? 'pointer' : 'not-allowed',
                                        transition: 'transform 120ms ease',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            transform: canStart ? 'translateY(-1px)' : 'none',
                                        },
                                        pointerEvents: 'auto',
                                    }}
                                >
                                    {modeAction && <span>{modeAction}</span>}
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

                        <ComposerOptions
                            open={optionsOpen}
                            onClose={closeSearchOptions}
                            effort={effort}
                            value={composerOptions}
                            onChange={setComposerOptions}
                            onReset={() => setComposerOptions(DEFAULT_COMPOSER_OPTIONS)}
                            showTools={optionsForChat}
                        >
                            {phoneOptionsHead}
                        </ComposerOptions>

                        {hasModeTabs && isMobileLayout && (
                            <ModeSheet
                                open={modeSheetOpen}
                                modes={modes}
                                mode={mode}
                                onClose={() => setModeSheetOpen(false)}
                                onPick={(next) => { setModeSheetOpen(false); changeMode(next); }}
                            />
                        )}

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
                    if (e.key === 'Enter' && !e.shiftKey) {
                        // Enter never adds a line; it sends only what the arrow would send.
                        e.preventDefault();
                        if (!canStart) return;
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
