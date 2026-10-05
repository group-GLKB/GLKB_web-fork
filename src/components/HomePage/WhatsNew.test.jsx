import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { getPost } from '../Blog/posts';
import WhatsNew, { NEWS } from './WhatsNew';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

const renderNews = (props = {}) =>
    render(
        <MemoryRouter>
            <WhatsNew {...props} />
        </MemoryRouter>,
    );

test('every article card opens a post that exists', () => {
    const linked = NEWS.filter((item) => item.to);
    expect(linked).toHaveLength(2);
    linked.forEach((item) => {
        const slug = item.to.replace('/blog/', '');
        expect(getPost(slug)).not.toBeNull();
    });
    renderNews();
    expect(screen.getByRole('link', { name: /Research reports you can audit/ }).getAttribute('href'))
        .toBe('/blog/investigate-auditable-research');
    expect(screen.getByRole('link', { name: /33M abstracts/ }).getAttribute('href'))
        .toBe('/blog/glkb-knowledge-graph');
});

test('the attachments card opens the composer attach control', () => {
    const onTryAttach = jest.fn();
    renderNews({ onTryAttach });
    fireEvent.click(screen.getByRole('button', { name: /Attach files and images/ }));
    expect(onTryAttach).toHaveBeenCalledTimes(1);
});
