import axios from 'axios';

const FEEDBACK_BASE_URL = '/api/v1/feedback';

export const submitChatFeedback = async ({ sessionId, rating, feedback = '' }) => {
    const payload = {
        history_id: sessionId,
        rating,
        feedback,
    };

    const response = await axios.post(FEEDBACK_BASE_URL, payload);
    return response.data;
};
