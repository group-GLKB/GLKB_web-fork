import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

import ReferenceCard from './ReferenceCard';

jest.mock('../../Auth/AuthContext', () => ({
    useAuth: () => ({
        isAuthenticated: false,
        loading: false,
        openLoginModal: jest.fn(),
    }),
}));

const renderCard = (evidence) => render(
    <MemoryRouter>
        <ReferenceCard
            url={[
                'A paper',
                'https://pubmed.ncbi.nlm.nih.gov/123/',
                4,
                2020,
                'Journal',
                'Ada Lovelace',
            ]}
            evidence={evidence}
            handleClick={() => {}}
        />
    </MemoryRouter>,
);

describe('ReferenceCard evidence expansion', () => {
    it('expands every reference sentence inside one quote block', () => {
        renderCard([
            { quote: 'First supporting sentence.' },
            { quote: 'Second supporting sentence.' },
            { quote: 'Third supporting sentence.' },
        ]);

        expect(screen.queryByText(/Second supporting/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Expand excerpts' }));

        const quoteContent = document.querySelector('.reference-card-quote-content');
        expect(quoteContent).toHaveTextContent('First supporting sentence.');
        expect(quoteContent).toHaveTextContent('Second supporting sentence.');
        expect(quoteContent).toHaveTextContent('Third supporting sentence.');
        expect(quoteContent.querySelectorAll('.reference-card-quote-text')).toHaveLength(3);
        expect(quoteContent.closest('.reference-card-quote')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collapse excerpts' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
    });

    it('collapses the additional sentences again', () => {
        renderCard([{ quote: 'First.' }, { quote: 'Second.' }]);
        fireEvent.click(screen.getByRole('button', { name: 'Expand excerpts' }));
        fireEvent.click(screen.getByRole('button', { name: 'Collapse excerpts' }));
        expect(screen.queryByText('“Second.”')).not.toBeInTheDocument();
    });
});
