import React, { useRef, useState } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  TextField,
  useMediaQuery,
} from '@mui/material';

import { ReactComponent as SearchArrowIcon } from '../../img/llm/search_arrow.svg';
import { pastedAttachments } from '../../service/attachments';
import {
    DEFAULT_EFFORT,
    effortLabel,
    isDeepEffort,
} from '../../service/effortLevels';
import { trackGtagEvent } from '../../utils/gtag';
import {
    AttachButton,
    AttachConflict,
    AttachmentChips,
    attachmentBlockedNote,
    dragHasFiles,
    filesFromTransfer,
} from '../Units/AttachmentChips';
import ComposerOptions, {
    DEFAULT_COMPOSER_OPTIONS,
    OptionsButton,
    optionsChanged,
} from '../Units/ComposerOptions';
import EffortPicker, { chooseEffort, EffortLevels } from '../Units/EffortPicker';
import TierPicker from '../Units/TierPicker';

/**
 * The composer at the foot of a conversation (design: GLKB Effort A) — the field, then a row:
 * "+", the model-and-effort chip, Options, send. The effort is per question: Medium asks the chat
 * agent, Extra runs deep research, in the same conversation.
 */
const ChatSearchBar = ({
    userInput,
    setUserInput,
    isLoading,
    isRunElsewhere = false,
    isQueryLimitReached = false,
    // Which service tier answers the next question (service/serviceTiers.js). Per-turn: the
    // reader can change it between two turns of one conversation and expects the next answer to
    // honour the change.
    serviceTier,
    onServiceTierChange,
    onServiceTierResolveDefault,
    // How hard the next question is worked on (service/effortLevels.js): Medium is the chat
    // agent, Extra deep research. Per-turn, like the tier.
    effort = DEFAULT_EFFORT,
    onEffortChange,
    // The Options drawer's choices (Units/ComposerOptions) for the next question.
    composerOptions = DEFAULT_COMPOSER_OPTIONS,
    onComposerOptionsChange,
    // A guest is held to Terra or Luna at Medium; reaching past asks them to sign in.
    isGuest = false,
    // (kind: 'model' | 'effort', entry)
    onRequireSignIn,
    /* The files waiting on this question (Units/AttachmentChips/useAttachments), owned by the
       parent because it reads them at send time. Absent: no "+" at all. */
    attachments = null,
    // A guest reaching for the "+" (or dropping a file) is asked to sign in.
    onAttachRequireSignIn,
    onSubmit,
    onStop,
}) => {
    const isMobileViewport = useMediaQuery('(max-width:767px)');
    const [isDragOver, setIsDragOver] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const boxRef = useRef(null);
    const deep = isDeepEffort(effort);
    /* Two different situations wear the same `isLoading`, and the field stays usable in both.

       THIS conversation is answering: a submit is queued by the parent, so a follow-up that
       occurs to the reader mid-answer leaves their hands at once instead of being held in
       their head for the length of a run. A second turn here really would race the first.

       ANOTHER conversation is answering (`isRunElsewhere`): nothing is racing. That run has
       its own session and its own history id, and the backend locks per history id — so this
       question simply starts, and the other answer goes on being written. */
    const canType = !isQueryLimitReached;
    /* Extra (deep research) does not read attachments, and a guest's question has no owner to
       keep a file for. Files waiting at Extra hold the send back, with the design's note
       offering Medium or removing them; a guest's "+" asks them to sign in. */
    const attachConflict = deep && Boolean(attachments?.hasItems);
    const attachmentNote = attachmentBlockedNote(attachments);
    const readyAttachmentCount = attachments?.readyAttachments?.length || 0;
    const canSend = (Boolean(userInput.trim()) || readyAttachmentCount > 0)
        && canType
        && !attachments?.isUploading
        && !attachmentNote
        && !attachConflict;
    const takeFiles = (files) => {
        if (!attachments || !files?.length) return;
        if (isGuest) {
            onAttachRequireSignIn?.();
            return;
        }
        if (!canType) return;
        attachments.addFiles(files);
    };
    // Stop is what the button offers when there is nothing to send. Typing turns it back into
    // send, which is also how a reader gets out of a queued follow-up they no longer want:
    // clear the field and the stop control is there again. There is nothing here to stop when
    // the run belongs to another thread.
    const showStop = isLoading && !isRunElsewhere && !canSend;
    const trackInvestigateSubmit = (inputMethod) => {
        if (!deep) return;
        trackGtagEvent('investigate_question_submit', {
            source: 'chat_searchbar',
            input_method: inputMethod,
            queued: Boolean(isLoading && !isRunElsewhere),
        });
    };
    const placeholder = isRunElsewhere
        ? (isMobileViewport ? 'Ask something new…' : 'Ask a new question — the other answer keeps writing')
        : (isLoading
            ? (isMobileViewport ? 'Ask next…' : 'Ask a follow-up — it will send when this answer finishes')
            : (isMobileViewport ? 'Ask more...' : 'Ask a follow-up…'));
    const submit = (event, queryMethod) => {
        if (!canSend) return;
        trackInvestigateSubmit(queryMethod);
        onSubmit?.(event, { queryMethod });
    };
    const optionsDot = optionsChanged(composerOptions);

    const stopRow = (event) => { event.preventDefault(); event.stopPropagation(); };

    return (
        <div className="chat-header">
        <Box
            ref={boxRef}
            className={`chat-composer${isDragOver ? ' attachment-drop-target' : ''}`}
            onDragOver={(event) => {
                if (!attachments || !dragHasFiles(event)) return;
                event.preventDefault();
                if (!isDragOver) setIsDragOver(true);
            }}
            onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setIsDragOver(false);
            }}
            onDrop={(event) => {
                if (!attachments || !dragHasFiles(event)) return;
                event.preventDefault();
                setIsDragOver(false);
                takeFiles(filesFromTransfer(event.dataTransfer));
            }}
            sx={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                margin: '0 auto',
                backgroundColor: '#F2F4F8',
                borderRadius: '16px',
                border: '1px solid #E5E9F0',
                boxShadow: 'none',
            }}
        >
            {attachments && (
                <AttachmentChips
                    variant="design"
                    items={attachments.items}
                    notice={attachments.notice}
                    blockedNote={attachmentNote}
                    onRemove={attachments.remove}
                />
            )}
            <TextField
                className="input-form"
                value={userInput}
                onPaste={(event) => {
                    /* A paste that carries files (any type) attaches them; a very long text
                       becomes "Pasted text.txt", as in Claude — but only where a file could be
                       attached and read, so a guest's paste, or one at Extra, still lands in the box. */
                    if (!attachments) return;
                    const files = pastedAttachments(event.clipboardData, {
                        longText: !isGuest && canType && !deep,
                    });
                    if (!files.length) return;
                    event.preventDefault();
                    takeFiles(files);
                }}
                onChange={(e) => {
                    if (!canType) return;
                    setUserInput(e.target.value);
                }}
                disabled={!canType}
                variant="outlined"
                placeholder={placeholder}
                multiline
                minRows={isMobileViewport ? 1 : 2}
                maxRows={6}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                        e.preventDefault();
                        submit(e, 'enter');
                    }
                }}
                sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                        padding: isMobileViewport ? '12px 16px 4px' : '14px 20px 6px',
                        fontFamily: 'Geist, sans-serif',
                        // 16px on a phone: below it iOS zooms the page in on focus.
                        fontSize: isMobileViewport ? '16px' : '14px',
                        color: '#0C1018',
                        '& fieldset': {
                            border: 'none',
                        },
                    },
                    '& .MuiInputBase-input': {
                        lineHeight: '22px',
                        padding: 0,
                    },
                    '& .MuiInputBase-input::placeholder': {
                        color: '#A8B3C8',
                        opacity: 1,
                    },
                }}
                fullWidth
            />
            {attachConflict && (
                <AttachConflict
                    effortName={effortLabel(effort)}
                    fallbackName={effortLabel(DEFAULT_EFFORT)}
                    count={attachments.items.length}
                    onUseFallback={() => onEffortChange?.(DEFAULT_EFFORT)}
                    onRemoveFiles={() => attachments.clear()}
                />
            )}
            <Box
                className="chat-composer-row"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px 12px',
                }}
            >
                {attachments && (
                    <AttachButton
                        variant="square"
                        label="Attach PDF, figure or spreadsheet"
                        onFiles={takeFiles}
                        isGuest={isGuest}
                        onRequireSignIn={onAttachRequireSignIn}
                        disabled={!canType}
                        source="chat_searchbar"
                    />
                )}
                <Box sx={{ flex: 1 }} />
                {!isMobileViewport && (
                    // Left usable while an answer streams: the choice applies to the NEXT
                    // request, never to the one in flight.
                    <EffortPicker
                        tier={serviceTier}
                        onTierChange={onServiceTierChange}
                        onTierResolveDefault={onServiceTierResolveDefault}
                        effort={effort}
                        onEffortChange={onEffortChange}
                        isGuest={isGuest}
                        onRequireSignIn={onRequireSignIn}
                        hasFiles={Boolean(attachments?.hasItems)}
                        placement="up"
                        anchorRef={boxRef}
                        disabled={isQueryLimitReached}
                    />
                )}
                <OptionsButton
                    compact={isMobileViewport}
                    open={optionsOpen}
                    changed={optionsDot}
                    onClick={() => {
                        trackGtagEvent('chat_options_open_click', { source: 'chat_searchbar' });
                        setOptionsOpen(true);
                    }}
                />
                {userInput !== '' && !isQueryLimitReached && !isLoading && (
                    <CloseIcon
                        onMouseDown={stopRow}
                        onClick={() => {
                            trackGtagEvent('chat_input_clear_click', { source: 'chat_searchbar' });
                            setUserInput('');
                        }}
                        sx={{ color: '#8090AB', cursor: 'pointer', fontSize: '20px' }}
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
                            flex: 'none',
                            borderRadius: '8px',
                            backgroundColor: '#D9E6FE',
                            border: 'none',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                        title="Stop"
                    >
                        <Box sx={{ width: 12, height: 12, backgroundColor: '#155DFC', borderRadius: '2px' }} />
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
                                investigate: deep,
                                queued: false,
                            });
                            submit(event, 'button');
                        }}
                        sx={{
                            width: 32,
                            height: 32,
                            flex: 'none',
                            borderRadius: '8px',
                            backgroundColor: canSend ? '#155DFC' : '#D9E6FE',
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
                                color: canSend ? '#fff' : '#155DFC',
                            }}
                        />
                    </Box>
                )}
            </Box>
            <ComposerOptions
                open={optionsOpen}
                onClose={() => setOptionsOpen(false)}
                effort={effort}
                value={composerOptions}
                onChange={onComposerOptionsChange}
                onReset={() => onComposerOptionsChange?.(DEFAULT_COMPOSER_OPTIONS)}
            >
                {isMobileViewport && (<>
                    <div className="composer-options-group-title">Model</div>
                    <div className="composer-options-group">
                        <TierPicker
                            variant="list"
                            value={serviceTier}
                            onChange={onServiceTierChange}
                            onResolveDefault={onServiceTierResolveDefault}
                            pipeline={deep ? 'deep_research' : 'chat'}
                            isGuest={isGuest}
                            onRequireSignIn={(tier) => onRequireSignIn?.('model', tier)}
                        />
                    </div>
                    <div className="composer-options-group-title">Effort</div>
                    <div className="composer-options-group">
                        <EffortLevels
                            effort={effort}
                            isGuest={isGuest}
                            hasFiles={Boolean(attachments?.hasItems)}
                            onPick={(level) => chooseEffort({
                                level, effort, isGuest, onEffortChange, onRequireSignIn,
                            })}
                        />
                    </div>
                </>)}
            </ComposerOptions>
        </Box>
        </div>
    );
};

export default ChatSearchBar;
