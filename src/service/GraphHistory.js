import axios from 'axios';

const API_BASE = '/api/v1/graphs/history';

export const listGraphHistories = async ({ offset = 0, limit = 20 } = {}) => {
    const response = await axios.get(API_BASE, {
        params: { offset, limit },
    });
    return response.data;
};

export const createGraphHistory = async ({ title = '', endpoint_type = '', graph_snapshot = [] } = {}) => {
    const response = await axios.post(API_BASE, {
        title,
        endpoint_type,
        graph_snapshot,
    });
    return response.data;
};

export const getGraphHistoryDetail = async (ghid) => {
    const response = await axios.get(`${API_BASE}/${ghid}`);
    return response.data;
};

export const updateGraphHistoryTitle = async (ghid, title) => {
    const response = await axios.patch(`${API_BASE}/${ghid}`, { title });
    return response.data;
};

export const deleteGraphHistory = async (ghid) => {
    const response = await axios.delete(`${API_BASE}/${ghid}`);
    return response.data;
};
