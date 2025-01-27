import axios from 'axios';

export class LLMAgentService {
    constructor() {}

    async sendQuestion(question) {
        console.log('Sending question to LLM agent');
        try {
            const response = await axios.post('/frontend/llm_agent', {
            // const response = await axios.post('/api/frontend/llm_agent', {
                question: question
            });
            
            return {
                answer: response.data.response,
                references: response.data.references || [],
                messages: response.data.messages || []
            };
        } catch (error) {
            console.error('LLM Agent error:', error);
            throw error;
        }
    }

    async getAnswer(question) {
        console.log('Getting answer from LLM agent');
        try {
            const response = await axios.get('/frontend/llm_agent', {
            // const response = await axios.get('/api/frontend/llm_agent', {
                params: {
                    question: question
                }
            });
            
            return {
                answer: response.data.response,
                references: response.data.references || [],
                messages: response.data.messages || []
            };
        } catch (error) {
            console.error('LLM Agent error:', error);
            throw error;
        }
    }
} 