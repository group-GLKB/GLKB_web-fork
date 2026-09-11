import axios from 'axios';

import { updateAvatar } from './Auth';

jest.mock('axios');

describe('updateAvatar', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('updates the cached profile when the deployed endpoint returns only a message', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 7, username: 'Ada', avatar_id: 1 }));
    axios.put.mockResolvedValue({ data: { message: 'Saved' } });

    const result = await updateAvatar(12);

    expect(axios.put).toHaveBeenCalledWith('/api/v1/email-auth/avatar', { avatar_id: 12 });
    expect(result).toMatchObject({ success: true, user: { id: 7, avatar_id: 12 } });
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ id: 7, avatar_id: 12 });
  });

  it('uses the authoritative user when the endpoint returns one', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 7, avatar_id: 1 }));
    axios.put.mockResolvedValue({
      data: { user: { id: 7, avatar_id: 5, tier: 'pro' } },
    });

    const result = await updateAvatar(5);

    expect(result.user).toEqual({ id: 7, avatar_id: 5, tier: 'pro' });
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(result.user);
  });
});
