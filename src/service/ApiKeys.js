import axios from 'axios';

const API_BASE = '/api/v1/api-keys';

export const listApiKeys = async () => {
    const response = await axios.get(`${API_BASE}/all_keys`);
    return response.data;
};

export const createApiKey = async (name) => {
    const response = await axios.post(`${API_BASE}/create`, { name });
    return response.data;
};

export const updateApiKeyStatus = async (apiId, status) => {
    const response = await axios.post(`${API_BASE}/status`, {
        api_id: apiId,
        status,
    });
    return response.data;
};

export const updateApiKeyName = async (apiId, name) => {
    const response = await axios.post(`${API_BASE}/name`, {
        api_id: apiId,
        name,
    });
    return response.data;
};
