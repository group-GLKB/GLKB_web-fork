import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

export const getClarificationQuestionKey = (question, index) => {
    const raw = typeof question?.header === 'string' ? question.header.trim() : '';
    return raw || `question-${index}`;
};

/**
 * Inline clarify panel — Figma "Asking Question" (node 111:4385), shown one question at a time.
 *
 * Three things here deliberately go past the design's mockups, because those show a single
 * question in a single state and a real round carries up to four:
 *
 *  1. ONE QUESTION AT A TIME, with Next/Back and an "i of n" counter. Stacking every question in
 *     one scrolling column buried the later ones and gave no sense of how many were left.
 *  2. SKIP IS ALWAYS AVAILABLE. The design's two frames show Skip on an untouched panel (111:4438)
 *     and Submit on an answered one (111:4845), so reading them literally swaps one for the other
 *     — which removes the escape hatch the moment you pick anything. The run cannot continue until
 *     the round is resolved, so there must always be a way to decline it.
 *  3. SINGLE AND MULTI LOOK DIFFERENT. The design draws the same selector for both. That is fine
 *     in a mockup and wrong in use: nothing tells you whether choosing a second option replaces
 *     your first. Pick-one gets a round radio, pick-any a square box plus "Select all that apply".
 *     Which one applies is the agent's `response_type` — rival readings of an ambiguous term
 *     ("T1" = T1-weighted MRI vs type 1 diabetes vs a T1 cell) are single, since a term means one
 *     thing; aspects that combine (mechanism, treatment, diagnosis) are multi.
 *
 * MUI's Radio/Checkbox/FormControlLabel are not used: their layout cannot be pushed into this row
 * shape without overriding nearly every internal rule, and row-as-target is not theirs to give.
 */
const ClarifyOptionRow = ({ index, label, description, selected, multi, disabled, onToggle }) => (
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
        <span className={`clarify-option-mark${multi ? '' : ' single'}`} aria-hidden="true">
            {selected ? <CheckIcon className="clarify-option-check" /> : null}
        </span>
    </div>
);

const emptyDraft = { selected: [], text: '', otherSelected: false };

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
    const questions = Array.isArray(pendingClarification?.questions)
        ? pendingClarification.questions
        : [];

    const [step, setStep] = useState(0);
    // A new round reuses this component, so the step has to go back to the first question — a
    // mid_research round arriving while the panel sat on question 3 would otherwise open there.
    const roundKey = `${pendingClarification?.invocationId || ''}:${questions.length}`;
    useEffect(() => { setStep(0); }, [roundKey]);

    if (!pendingClarification || !questions.length) return null;

    const index = Math.min(step, questions.length - 1);
    const question = questions[index];
    const questionKey = getClarificationQuestionKey(question, index);
    const draft = clarificationDrafts[questionKey] || emptyDraft;
    const selected = Array.isArray(draft.selected) ? draft.selected : [];
    const otherText = typeof draft.text === 'string' ? draft.text : '';
    const responseType = String(question?.response_type || 'text').toLowerCase();
    const multi = responseType === 'multi';
    const options = responseType === 'text'
        ? []
        : (Array.isArray(question?.options) ? question.options : []);
    const otherSelected = Boolean(draft.otherSelected) || responseType === 'text';
    const isLast = index === questions.length - 1;

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
        // pick-one: choosing replaces whatever was there, Other included
        const alreadyOnly = selected.length === 1 && selected[0] === optionLabel;
        onUpdateDraft(questionKey, {
            selected: alreadyOnly ? [] : [optionLabel],
            text: '',
            otherSelected: false,
        });
    };

    const toggleOther = () => {
        onUpdateDraft(questionKey, {
            selected: multi ? selected : [],
            text: otherText,
            otherSelected: !draft.otherSelected,
        });
    };

    return (
        <Box className="clarify-panel" role="region" aria-label="Clarifying questions">
            <div className="clarify-question">
                <div className="clarify-question-head">
                    <p className="clarify-question-text">
                        {question?.question || question?.header || `Question ${index + 1}`}
                    </p>
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
                </div>

                {multi && (
                    <p className="clarify-hint">Select all that apply</p>
                )}

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

                    {/* Always offered: the agent's options are its guess at the axes that matter,
                        and the user may need one it did not think of. */}
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
                                        onUpdateDraft(questionKey, {
                                            selected: multi ? selected : [],
                                            text: event.target.value,
                                            otherSelected: true,
                                        });
                                    }}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            className={`clarify-option-mark${multi ? '' : ' single'}`}
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

            {clarificationError && (
                <Typography className="clarify-error">{clarificationError}</Typography>
            )}

            <Box className="clarify-actions">
                <button
                    type="button"
                    className="clarify-skip"
                    disabled={clarificationSubmitting}
                    onClick={() => onSkip?.()}
                >
                    Skip
                </button>
                <span className="clarify-actions-spacer" />
                {questions.length > 1 && (
                    <span className="clarify-step" aria-live="polite">
                        {index + 1} of {questions.length}
                    </span>
                )}
                {index > 0 && (
                    <button
                        type="button"
                        className="clarify-back"
                        disabled={clarificationSubmitting}
                        onClick={() => setStep(index - 1)}
                    >
                        <ArrowBackIcon className="clarify-submit-icon" />
                        Back
                    </button>
                )}
                {isLast ? (
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
                    // Next is never blocked on an answer: leaving one blank is a valid choice, and
                    // the agent falls back to that question's own `default`.
                    <button
                        type="button"
                        className="clarify-submit"
                        disabled={clarificationSubmitting}
                        onClick={() => setStep(index + 1)}
                    >
                        Next
                        <ArrowForwardIcon className="clarify-submit-icon" />
                    </button>
                )}
            </Box>
        </Box>
    );
};

export default ClarifyPanel;
