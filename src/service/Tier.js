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

export const upgradeToAdmin = async (passcode) => {
    try {
        const response = await axios.post(`${TIER_BASE_URL}/upgrade-to-admin`, {
            passcode,
        });
        return {
            success: true,
            data: response.data,
            message: 'Upgraded to admin tier successfully.',
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.detail || 'Failed to upgrade to admin tier.',
        };
    }
};
