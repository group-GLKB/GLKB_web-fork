import axios from 'axios';

const API_BASE = '/api/v1/new-llm-agent/history';

export const listChatHistories = async ({ offset = 0, limit = 20 } = {}) => {
    const response = await axios.get(API_BASE, {
        params: { offset, limit },
    });
    return response.data;
};

export const createChatHistory = async (leadingTitle = null) => {
    const response = await axios.post(API_BASE, {
        leading_title: leadingTitle ?? null,
    });
    return response.data;
};

export const getChatHistoryDetail = async (hid) => {
    const response = await axios.get(`${API_BASE}/${hid}`);
    return response.data;
};

export const updateChatHistoryTitle = async (hid, leadingTitle) => {
    const response = await axios.patch(`${API_BASE}/${hid}`, {
        leading_title: leadingTitle,
    });
    return response.data;
};

export const deleteChatHistory = async (hid) => {
    const response = await axios.delete(`${API_BASE}/${hid}`);
    return response.data;
};
