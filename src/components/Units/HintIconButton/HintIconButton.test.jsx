import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HintIconButton from './index';

it('shows a styled hint instead of a native title and preserves click behavior', async () => {
    const click = jest.fn();
    const { container } = render(<HintIconButton title="Copy response" onClick={click}>Copy</HintIconButton>);
    const button = screen.getByRole('button', { name: 'Copy response' });
    expect(container.querySelector('[title]')).toBeNull();
    fireEvent.mouseOver(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Copy response');
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
});
it('keeps disabled actions disabled', () => {
    const click = jest.fn();
    render(<HintIconButton title="Regenerate response" disabled onClick={click}>Refresh</HintIconButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate response' }));
    expect(click).not.toHaveBeenCalled();
});
