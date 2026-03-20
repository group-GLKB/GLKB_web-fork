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

export const listFavoriteGraphs = async () => {
    const response = await axios.get(`${API_BASE}/graph`);
    return response.data;
};

export const addFavoriteGraph = async (ghid) => {
    const response = await axios.post(`${API_BASE}/graph`, { ghid });
    return response.data;
};

export const removeFavoriteGraph = async (ghid) => {
    const response = await axios.delete(`${API_BASE}/graph/${ghid}`);
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

export const listFavoriteFolders = async () => {
    const response = await axios.get(`${API_BASE}/folder`);
    return response.data;
};

export const getFavoriteFolder = async (fid) => {
    const response = await axios.get(`${API_BASE}/folder/${fid}`);
    return response.data;
};

export const createFavoriteFolder = async (name) => {
    const response = await axios.post(`${API_BASE}/folder`, { name });
    return response.data;
};

export const duplicateFavoriteFolder = async (fid) => {
    const response = await axios.post(`${API_BASE}/folder/${fid}/duplicate`);
    return response.data;
};

export const updateFavoriteFolder = async (fid, name) => {
    const response = await axios.patch(`${API_BASE}/folder/${fid}`, { name });
    return response.data;
};

export const removeFavoriteFolder = async (fid) => {
    const response = await axios.delete(`${API_BASE}/folder/${fid}`);
    return response.data;
};

export const updateFavoriteChatFolder = async (hid, folderId, action) => {
    const response = await axios.patch(`${API_BASE}/chat/${hid}`,
        {
            folder_id: folderId,
            action,
        });
    return response.data;
};

export const updateFavoriteGraphFolder = async (ghid, folderId, action) => {
    const response = await axios.patch(`${API_BASE}/graph/${ghid}`,
        {
            folder_id: folderId,
            action,
        });
    return response.data;
};

export const updateFavoriteReferenceFolder = async (pmid, folderId, action) => {
    const response = await axios.patch(`${API_BASE}/reference/${pmid}`,
        {
            folder_id: folderId,
            action,
        });
    return response.data;
};
