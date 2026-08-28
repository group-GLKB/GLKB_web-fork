import axios from 'axios';

const API_BASE = '/api/v1/new-llm-agent/history';

export const listChatHistories = async ({ offset = 0, limit = 20 } = {}) => {
    const response = await axios.get(API_BASE, {
        params: { offset, limit },
    });
    return response.data;
};

/**
 * `is_investigate` is optional and only sent when true: /deep-research/stream sets it
 * anyway when the run starts, but sending it here means the conversation is labelled
 * from the moment it appears in History rather than once the answer lands. A server
 * without the field ignores it.
 */
export const createChatHistory = async (leadingTitle = null, isInvestigate = false) => {
    const response = await axios.post(API_BASE, {
        leading_title: leadingTitle ?? null,
        ...(isInvestigate ? { is_investigate: true } : {}),
    });
    return response.data;
};

export const getChatHistoryDetail = async (hid) => {
    const response = await axios.get(`${API_BASE}/${hid}`);
    return response.data;
};

/**
 * The same conversation, addressed by the id that can live in a URL.
 *
 * `hid` is the row's primary key: sequential, and it says how many conversations exist on
 * the deployment. `public_id` is a UUID the backend mints for exactly this purpose, so a
 * shareable /chat/<id> link neither enumerates nor counts.
 */
export const getChatHistoryDetailByPublicId = async (publicId) => {
    const response = await axios.get(`${API_BASE}/public/${publicId}`);
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
