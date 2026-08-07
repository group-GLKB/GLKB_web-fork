import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

export const getClarificationQuestionKey = (question, index) => {
    const raw = typeof question?.header === 'string' ? question.header.trim() : '';
    return raw || `question-${index}`;
};

/**
 * Inline clarify panel — Figma "Asking Question" (node 111:4385).
 *
 * Every option is one card the whole width of the panel: index, label, description, and a 16px
 * selector on the right. Single- and multi-select look identical by design; only the semantics
 * differ, so the row carries `role="radio"` or `role="checkbox"` and MUI's Radio/Checkbox/
 * FormControlLabel are not used — their layout cannot be pushed into this shape without fighting
 * every one of their internal rules.
 *
 * The footer is ONE button, per the design's own state frames: "Skip" while nothing is answered
 * (111:4438), "Submit" once something is (111:4845). Nothing is trapped by that — Skip and an
 * empty Submit reach the same place, since the agent falls back to each question's `default`.
 */
const ClarifyOptionRow = ({
    index,
    label,
    description,
    selected,
    multi,
    disabled,
    onToggle,
}) => (
    <div
        className={`clarify-option${selected ? ' selected' : ''}`}
        role={multi ? 'checkbox' : 'radio'}
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onToggle()}
        onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggle();
            }
        }}
    >
        <div className="clarify-option-body">
            <div className="clarify-option-line">
                <span className="clarify-option-index" aria-hidden="true">{index}.</span>
                <span className="clarify-option-label">{label}</span>
            </div>
            {description ? (
                <div className="clarify-option-descwrap">
                    <p className="clarify-option-desc">{description}</p>
                </div>
            ) : null}
        </div>
        <span className="clarify-option-mark" aria-hidden="true">
            {selected ? <CheckIcon className="clarify-option-check" /> : null}
        </span>
    </div>
);

export const ClarifyPanel = ({
    pendingClarification,
    clarificationDrafts,
    clarificationError,
    clarificationSubmitting,
    hasInvalidOtherSelection,
    onUpdateDraft,
    onSubmit,
    onSkip,
}) => {
    if (!pendingClarification) return null;

    const questions = Array.isArray(pendingClarification.questions)
        ? pendingClarification.questions
        : [];

    const draftFor = (question, index) => (
        clarificationDrafts[getClarificationQuestionKey(question, index)]
        || { selected: [], text: '', otherSelected: false }
    );

    // Which button the footer shows. An answer is a chosen option or typed "Other" text — an
    // empty Other radio is not an answer, or clicking it would turn Skip into Submit with
    // nothing to submit.
    const anyAnswered = questions.some((question, index) => {
        const draft = draftFor(question, index);
        const picked = Array.isArray(draft.selected) ? draft.selected : [];
        return picked.length > 0 || Boolean(String(draft.text || '').trim());
    });

    return (
        <Box className="clarify-panel" role="region" aria-label="Clarifying questions">
            {questions.map((question, index) => {
                const questionKey = getClarificationQuestionKey(question, index);
                const draft = draftFor(question, index);
                const selected = Array.isArray(draft.selected) ? draft.selected : [];
                const otherText = typeof draft.text === 'string' ? draft.text : '';
                const responseType = String(question?.response_type || 'text').toLowerCase();
                const multi = responseType === 'multi';
                const options = responseType === 'text'
                    ? []
                    : (Array.isArray(question?.options) ? question.options : []);
                const otherSelected = Boolean(draft.otherSelected) || (responseType === 'text');

                const toggleOption = (optionLabel) => {
                    if (multi) {
                        const next = selected.includes(optionLabel)
                            ? selected.filter((item) => item !== optionLabel)
                            : [...selected, optionLabel];
                        onUpdateDraft(questionKey, {
                            selected: Array.from(new Set(next)),
                            text: otherText,
                            otherSelected: Boolean(draft.otherSelected),
                        });
                        return;
                    }
                    // single: picking an option replaces the answer, Other included
                    const alreadyOnly = selected.length === 1 && selected[0] === optionLabel;
                    onUpdateDraft(questionKey, {
                        selected: alreadyOnly ? [] : [optionLabel],
                        text: '',
                        otherSelected: false,
                    });
                };

                const toggleOther = () => {
                    if (multi) {
                        onUpdateDraft(questionKey, {
                            selected,
                            text: otherText,
                            otherSelected: !draft.otherSelected,
                        });
                        return;
                    }
                    onUpdateDraft(questionKey, {
                        selected: [],
                        text: otherText,
                        otherSelected: !draft.otherSelected,
                    });
                };

                return (
                    <div className="clarify-question" key={questionKey}>
                        <div className="clarify-question-head">
                            <p className="clarify-question-text">
                                {question?.question || question?.header || `Question ${index + 1}`}
                            </p>
                            {index === 0 ? (
                                <button
                                    type="button"
                                    className="clarify-close"
                                    onClick={() => onSkip?.()}
                                    disabled={clarificationSubmitting}
                                    aria-label="Skip these questions"
                                    title="Skip"
                                >
                                    <ClearIcon className="clarify-close-icon" />
                                </button>
                            ) : null}
                        </div>

                        <div
                            className="clarify-options"
                            role={multi ? 'group' : 'radiogroup'}
                            aria-label={question?.header || 'Options'}
                        >
                            {options.map((option, optionIndex) => {
                                const optionLabel = String(option?.label || '').trim();
                                if (!optionLabel) return null;
                                return (
                                    <ClarifyOptionRow
                                        key={optionLabel}
                                        index={optionIndex + 1}
                                        label={optionLabel}
                                        description={option?.description || ''}
                                        selected={selected.includes(optionLabel)}
                                        multi={multi}
                                        disabled={clarificationSubmitting}
                                        onToggle={() => toggleOption(optionLabel)}
                                    />
                                );
                            })}

                            {/* "Other" is always offered — the agent's questions are a guess at the
                                axes that matter, and the user may need one that is not listed. */}
                            <div className={`clarify-option clarify-other${otherSelected ? ' selected' : ''}`}>
                                <div className="clarify-option-body">
                                    <div className="clarify-option-line">
                                        <span className="clarify-other-icon" aria-hidden="true">
                                            <EditOutlinedIcon className="clarify-other-pencil" />
                                        </span>
                                        <span className="clarify-option-label">Other</span>
                                    </div>
                                    <div className="clarify-option-descwrap">
                                        <input
                                            className="clarify-other-input"
                                            type="text"
                                            placeholder="Type your own answer here"
                                            value={otherText}
                                            disabled={clarificationSubmitting}
                                            aria-label={`Other answer for ${question?.header || 'this question'}`}
                                            onChange={(event) => {
                                                const text = event.target.value;
                                                onUpdateDraft(questionKey, {
                                                    selected: multi ? selected : [],
                                                    text,
                                                    otherSelected: true,
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="clarify-option-mark"
                                    role={multi ? 'checkbox' : 'radio'}
                                    aria-checked={otherSelected}
                                    aria-label="Use my own answer"
                                    disabled={clarificationSubmitting}
                                    onClick={toggleOther}
                                >
                                    {otherSelected ? <CheckIcon className="clarify-option-check" /> : null}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}

            {clarificationError && (
                <Typography className="clarify-error">{clarificationError}</Typography>
            )}

            <Box className="clarify-actions">
                {anyAnswered ? (
                    <button
                        type="button"
                        className="clarify-submit"
                        disabled={clarificationSubmitting || hasInvalidOtherSelection}
                        onClick={() => onSubmit?.()}
                    >
                        {clarificationSubmitting ? 'Submitting…' : 'Submit'}
                        <ArrowForwardIcon className="clarify-submit-icon" />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="clarify-skip"
                        disabled={clarificationSubmitting}
                        onClick={() => onSkip?.()}
                    >
                        Skip
                    </button>
                )}
            </Box>
        </Box>
    );
};



export default ClarifyPanel;
