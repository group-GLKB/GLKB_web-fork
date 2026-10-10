import React from 'react';
import CheckIcon from '@mui/icons-material/Check';

/** The four steps of a review, as the design names them. */
export const STEPS = ['Scope', 'Outline', 'Writing', 'Review'];

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
                <button type="button" className="lr-crumb-section" onClick={onNew}>Literature Review</button>
            </nav>
            <Stepper current={step} />
            <div className="lr-topbar-actions">{actions}</div>
        </header>
    );
}
