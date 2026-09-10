import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from './AuthContext';
import * as AuthService from '../../service/Auth';

jest.mock('../../service/Auth');

const AvatarHarness = () => {
  const { user, updateAvatar } = useAuth();
  return (
    <>
      <span data-testid="avatar-id">{String(user?.avatar_id ?? '')}</span>
      <button type="button" onClick={() => updateAvatar(9)}>Choose avatar 9</button>
    </>
  );
};

describe('AuthProvider avatar updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AuthService.getToken.mockReturnValue('token');
    AuthService.getCurrentUser.mockReturnValue({ id: 1, username: 'Ada', avatar_id: 2 });
  });

  it('updates every profile consumer even when the endpoint omits its user payload', async () => {
    AuthService.updateAvatar.mockResolvedValue({ success: true, message: 'Saved' });

    render(
      <AuthProvider>
        <AvatarHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('avatar-id')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose avatar 9' }));
    await waitFor(() => expect(screen.getByTestId('avatar-id')).toHaveTextContent('9'));
  });
});
