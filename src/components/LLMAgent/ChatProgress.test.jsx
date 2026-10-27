/** The chat's loading panel: the Investigate panel's look, the chat's own stages, no invented numbers. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatProgress, { chatStageFor } from './ChatProgress';

const labels = () => Array.from(document.querySelectorAll('.ip-step-label')).map((n) => n.textContent);

it('lists the stages reached so far, the current one in the present tense', () => {
    render(<ChatProgress phase="reading" label="Reading full text" startedAt={Date.now()} />);
    expect(labels()).toEqual([
        'Understood the question',
        'Searched the literature and the knowledge graph',
        'Reading the papers',
    ]);
    expect(document.querySelector('.ip-head-title')).toHaveTextContent('Reading the papers');
    // the agent's own word for what it is doing now, under the active stage
    expect(document.querySelector('.ip-step.active .ip-step-detail')).toHaveTextContent('Reading full text');
});

it('shows no counters: the chat has no funnel to report', () => {
    render(<ChatProgress phase="searching" />);
    expect(document.querySelector('.ip-counters')).toBeNull();
    expect(document.querySelector('.ip-counter')).toBeNull();
});

it('puts the opening line under the first stage while the agent starts', () => {
    render(<ChatProgress phase="planning" preamble="Let me look into TP53 and cisplatin." />);
    expect(document.querySelector('.ip-step.active .ip-step-detail'))
        .toHaveTextContent('Let me look into TP53 and cisplatin.');
});

it('fills the bar to the percent the agent reported, else to the stage floor', () => {
    const { rerender } = render(<ChatProgress phase="writing" percent={70} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
    rerender(<ChatProgress phase="writing" percent={null} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
});

it('shows the time spent from when the question was sent', () => {
    render(<ChatProgress phase="planning" startedAt={Date.now() - 65000} />);
    expect(document.querySelector('.ip-elapsed')).toHaveTextContent('1:05');
});

it('collapses and expands from its header', () => {
    render(<ChatProgress phase="searching" />);
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(document.querySelector('.ip-body')).toHaveClass('collapsed');
});

it('folds the deep-research phase names onto the chat stages', () => {
    expect(chatStageFor('screening')).toBe('searching');
    expect(chatStageFor('analyzing')).toBe('reading');
    expect(chatStageFor('verifying')).toBe('finalizing');
    expect(chatStageFor(undefined)).toBe('planning');
});
