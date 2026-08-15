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
 * The row's right-hand marker — Figma "Asking User Question v2" (577:6744 for pick-one, 577:6961
 * for pick-any). One 16px rounded square in both modes, filling with brand/primary and a check
 * once the row is chosen; what differs at rest is what it holds. Pick-one numbers its options,
 * pick-any leaves the box empty, and that is the whole of the design's answer to "does a second
 * click add to my choice or replace it" — so the number is not decoration and does not move into
 * the label, where it was before this design.
 */
const ClarifyMark = ({ number, selected, multi }) => (
    <>
        {selected
            ? <CheckIcon className="clarify-option-check" />
            : (multi ? null : <span className="clarify-option-marknum">{number}</span>)}
    </>
);

/**
 * Inline clarify panel — Figma "Asking User Question v2" (node 581:7642), one question at a time.
 *
 * Where this goes past the design's four frames, it is because they draw one question in one state
 * and a real round carries up to four:
 *
 *  1. ONE QUESTION AT A TIME. The design's own title carries "(1/3)", so it means the same thing;
 *     the counter is rendered there rather than in the footer, which the design keeps to a single
 *     action. Stacking every question in one scrolling column buried the later ones.
 *  2. BACK. Nothing in the design offers a way back to question 1 after leaving it, which is fine
 *     for a mockup of a single frame and not for a round you step through.
 *  3. SKIP MEANS "DON'T ANSWER", AT WHATEVER SCOPE IS LEFT. The design swaps one action between
 *     Skip and Submit. Mid-round that action still has somewhere to go, so Skip advances past the
 *     question; on the last one, with nothing answered anywhere, it declines the round. Declining
 *     outright is always available from the header's ✕, so nothing traps a user who has picked
 *     something and changed their mind.
 *
 * Which mode applies is the agent's `response_type` — rival readings of an ambiguous term ("T1" =
 * T1-weighted MRI vs type 1 diabetes vs a T1 cell) are single, since a term means one thing;
 * aspects that combine (mechanism, treatment, diagnosis) are multi.
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
                <span className="clarify-option-label">{label}</span>
            </div>
            {description ? (
                <div className="clarify-option-descwrap">
                    <p className="clarify-option-desc">{description}</p>
                </div>
            ) : null}
        </div>
        <span className={`clarify-option-mark${selected ? ' selected' : ''}`} aria-hidden="true">
            <ClarifyMark number={index} selected={selected} multi={multi} />
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

    const isAnswered = (entry) => (Array.isArray(entry?.selected) && entry.selected.length > 0)
        || (Boolean(entry?.otherSelected) && Boolean(String(entry?.text || '').trim()));
    // Read over this round's own question keys rather than every key in `clarificationDrafts`: the
    // container carries drafts across rounds, so a stale key from the last one would otherwise
    // count as an answer here and turn the final Skip into a Submit of nothing.
    const anyAnswered = questions.some(
        (item, itemIndex) => isAnswered(clarificationDrafts[getClarificationQuestionKey(item, itemIndex)]),
    );

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
                        {/* "Example question lorem ipsum? (1/3)" — the design puts the round's
                            position in the title, which is why the footer needs no counter. */}
                        {questions.length > 1 ? (
                            <span className="clarify-question-step">
                                {` (${index + 1}/${questions.length})`}
                            </span>
                        ) : null}
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
                            className={`clarify-option-mark${otherSelected ? ' selected' : ''}`}
                            role={multi ? 'checkbox' : 'radio'}
                            aria-checked={otherSelected}
                            aria-label="Use my own answer"
                            disabled={clarificationSubmitting}
                            onClick={toggleOther}
                        >
                            {/* Other is the last option, and carries the number after them. */}
                            <ClarifyMark
                                number={options.length + 1}
                                selected={otherSelected}
                                multi={multi}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {clarificationError && (
                <Typography className="clarify-error">{clarificationError}</Typography>
            )}

            {/* One action, right-aligned, as the design draws it — reading Skip until something is
                answered and Submit after. Back is the only addition, and only once there is
                somewhere to go back to. */}
            <Box className="clarify-actions">
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
                {!isLast ? (
                    // Advancing is never blocked on an answer: leaving one blank is a valid choice,
                    // and the agent falls back to that question's own `default`. The label says
                    // which of the two is happening.
                    <button
                        type="button"
                        className={isAnswered(draft) ? 'clarify-submit' : 'clarify-skip'}
                        disabled={clarificationSubmitting}
                        onClick={() => setStep(index + 1)}
                    >
                        {isAnswered(draft) ? 'Next' : 'Skip'}
                        {isAnswered(draft) ? <ArrowForwardIcon className="clarify-submit-icon" /> : null}
                    </button>
                ) : anyAnswered ? (
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
                    // Nothing answered anywhere in the round, and nowhere left to advance to —
                    // here Skip is the round itself, which is what the design's Skip frame shows.
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
