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

export const isFreePlanLimitReached = (tierInfo) => {
    const normalizedTier = `${tierInfo?.tier || 'free'}`.toLowerCase();
    if (normalizedTier !== 'free') return false;

    const quotaRemaining = Number(tierInfo?.quota_remaining);
    const quotaUsed = Number(tierInfo?.quota_used);
    const quotaLimit = Number(tierInfo?.quota_limit);

    if (Number.isFinite(quotaRemaining)) {
        return quotaRemaining <= 0;
    }

    if (Number.isFinite(quotaUsed) && Number.isFinite(quotaLimit) && quotaLimit > 0) {
        return quotaUsed >= quotaLimit;
    }

    return false;
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

export const upgradeToPro = async (passcode) => {
    try {
        const response = await axios.post(`${TIER_BASE_URL}/upgrade-to-pro`, {
            passcode,
        });
        return {
            success: true,
            data: response.data,
            message: 'Upgraded to pro tier successfully.',
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.detail || 'Failed to upgrade to pro tier.',
        };
    }
};
