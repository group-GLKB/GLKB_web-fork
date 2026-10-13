/**
 * The app's dropdown: the current option checked, a pick closing it, the keyboard moving through
 * it, and a blocked option explaining itself instead of being chosen.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { OptionSelect } from './index';

const OPTIONS = [
    { id: 'search', label: 'Search only', hint: 'GLKB finds the literature' },
    { id: 'papers', label: 'Your papers only', blocked: { note: 'Upload a paper first.', action: null } },
    { id: 'both', label: 'Both' },
];

function Harness({ onUpload }) {
    const [value, setValue] = useState('search');
    const options = OPTIONS.map((o) => (o.blocked ? { ...o, blocked: { ...o.blocked, action: { label: 'Upload', onClick: onUpload } } } : o));
    return (
        <OptionSelect label={`Sources: ${value}`} panelLabel="Sources" value={value} options={options}
                      onChange={setValue} />
    );
}

it('shows the current option checked, and a pick closes it', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Sources: search' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Sources' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Search only/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('GLKB finds the literature')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Both' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sources: both' })).toBeInTheDocument();
});

it('moves through the options with the arrow keys and closes on Escape', () => {
    jest.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Sources: search' }));
    jest.runAllTimers();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(options[1]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(options[2]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    jest.useRealTimers();
});

it('explains a blocked option instead of choosing it, and offers its action', () => {
    const onUpload = jest.fn();
    render(<Harness onUpload={onUpload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sources: search' }));
    const blocked = screen.getByRole('option', { name: 'Your papers only' });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(blocked);
    expect(screen.getByRole('status')).toHaveTextContent('Upload a paper first.');
    expect(screen.getByRole('option', { name: /Search only/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
