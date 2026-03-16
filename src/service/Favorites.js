import axios from 'axios';

const API_BASE = '/api/v1/fav';

export const listFavoriteChats = async () => {
    const response = await axios.get(`${API_BASE}/chat`);
    return response.data;
};

export const addFavoriteChat = async (hid) => {
    const response = await axios.post(`${API_BASE}/chat`, { hid });
    return response.data;
};

export const removeFavoriteChat = async (hid) => {
    const response = await axios.delete(`${API_BASE}/chat/${hid}`);
    return response.data;
};

export const listFavoriteReferences = async () => {
    const response = await axios.get(`${API_BASE}/reference`);
    return response.data;
};

export const addFavoriteReference = async (pmid, refJson, sourceHid = null) => {
    const payload = {
        pmid,
        ref_json: refJson,
    };
    if (sourceHid !== null && sourceHid !== undefined) {
        payload.source_hid = sourceHid;
    }
    const response = await axios.post(`${API_BASE}/reference`, payload);
    return response.data;
};

export const removeFavoriteReference = async (pmid) => {
    const response = await axios.delete(`${API_BASE}/reference/${pmid}`);
    return response.data;
};
