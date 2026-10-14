import React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';

import BetaBadge from '../Units/BetaBadge';

/** The four steps of a review, as the design names them. */
export const STEPS = ['Scope', 'Outline', 'Writing', 'Review'];
/** The same steps as the phone design titles its top bar (the finished review is the "Draft"). */
export const PHONE_STEP_TITLES = ['Scope', 'Outline', 'Writing', 'Draft'];

/** Step states: index < current is done, === current is the one in hand. */
export function Stepper({ current }) {
    return (
        <ol className="lr-stepper" aria-label="Review progress">
            {STEPS.map((label, i) => {
                const state = i < current ? 'done' : i === current ? 'current' : 'todo';
                return (
                    <li key={label} className={`lr-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="lr-step-mark">
                            {state === 'done' ? <CheckIcon style={{ width: 14, height: 14 }} /> : i + 1}
                        </span>
                        <span className="lr-step-label">{label}</span>
                        {i < STEPS.length - 1 && <span className="lr-step-rule" aria-hidden="true" />}
                    </li>
                );
            })}
        </ol>
    );
}

/** The bar along the top of every Literature Review page. */
export function TopBar({ step, onHome, onNew, actions }) {
    return (
        <header className="lr-topbar">
            <nav className="lr-crumbs">
                <button type="button" className="lr-crumb-home" onClick={onHome}>← Home</button>
                <button type="button" className="lr-crumb-section" onClick={onNew}>Literature Review<BetaBadge /></button>
            </nav>
            <Stepper current={step} />
            <div className="lr-topbar-actions">{actions}</div>
        </header>
    );
}

/**
 * The phone's bar (the phone design): back, "Literature Review" over the step, one action on the
 * right, and the four steps as a segmented bar underneath. It stands in for the app's own phone
 * header, which Layout leaves out on these pages.
 */
export function PhoneTopBar({ step, onHome, onNew, action }) {
    return (
        <header className="lr-mtopbar">
            <div className="lr-mtopbar-row">
                <button type="button" className="lr-mtopbar-back" aria-label="Home" onClick={onHome}>
                    <ArrowBackIcon style={{ width: 24, height: 24 }} />
                </button>
                <div className="lr-mtopbar-title">
                    <button type="button" className="lr-mtopbar-kicker" onClick={onNew}>
                        Literature Review<BetaBadge style={{ marginLeft: 4, padding: '0 4px', fontSize: 9, lineHeight: '13px' }} />
                    </button>
                    <span className="lr-mtopbar-step">{PHONE_STEP_TITLES[step]}</span>
                </div>
                <div className="lr-mtopbar-action">{action}</div>
            </div>
            <ol className="lr-msteps" aria-label="Review progress">
                {STEPS.map((label, i) => (
                    <li key={label} className={i <= step ? 'is-on' : ''} aria-current={i === step ? 'step' : undefined}>
                        <span className="lr-visually-hidden">{`${label}${i < step ? ' (done)' : ''}`}</span>
                    </li>
                ))}
            </ol>
        </header>
    );
}
