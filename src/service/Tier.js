import axios from 'axios';

const TIER_BASE_URL = '/api/v1/tier';

export const getMyTier = async () => {
  try {
    const response = await axios.get(`${TIER_BASE_URL}/me`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.detail || 'Failed to load subscription usage.',
    };
  }
};
