import axios from 'axios';

export class LLMAgentService {
    constructor() {
        this.messages = [];
        // console.log('LLMAgentService initialized with empty messages:', this.messages);
    }

    async processStream(response, abortController, onUpdate) {
        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // console.log('Starting to process stream...');

            while (true) {
                if (abortController.signal.aborted) {
                    // console.log('Stream processing aborted early');
                    return;
                }
                const { value, done } = await reader.read();
                if (done) {
                    // console.log('Stream complete');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process each line as it comes
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last incomplete line

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);
                        // console.log('Processing data:', data);

                        // Handle the Complete step differently
                        if (data.step === 'Complete') {
                            // Send the final response
                            await onUpdate({
                                type: 'final',
                                answer: data.response,
                                references: data.references || [],
                                messages: data.messages || []
                            });
                        }
                        // Forward all other steps to the UI
                        else if (data.step && data.content) {
                            onUpdate({
                                type: 'step',
                                step: data.step,
                                content: data.content
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e, 'Line:', line);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // console.log('Stream processing aborted');
                await onUpdate({
                    type: 'final',
                    answer: "**Response aborted by user.**",
                    references: [],
                    messages: []
                });
                return;
            } else {
                console.error('Error processing stream:', error);
                throw error;

            }
        }
    }

    async chat(question, abortController, onUpdate) {
        try {
            // Add user message to history
            this.messages.push({
                role: 'user',
                content: question
            });
            // console.log('Added user message to history. Current messages:', this.messages);

            // console.log('Sending request to server with messages:', {
            //     question,
            //     messages: this.messages
            // });

            let buffer = '';
            let processedLength = 0;

            const processSSEChunk = (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);

                        if (data.step === 'Complete') {
                            onUpdate({
                                type: 'final',
                                answer: data.response,
                                references: data.references || [],
                                messages: data.messages || []
                            });
                        } else if (data.step && data.content) {
                            onUpdate({
                                type: 'step',
                                step: data.step,
                                content: data.content
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e, 'Line:', line);
                    }
                }
            };

            await axios.post('/api/v1/llm-agent/stream', {
                question,
                messages: this.messages
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                responseType: 'text',
                signal: abortController.signal,
                onDownloadProgress: (progressEvent) => {
                    const xhr = progressEvent.event?.target || progressEvent.target;
                    const responseText = xhr?.responseText;
                    if (!responseText) return;

                    const chunk = responseText.slice(processedLength);
                    if (!chunk) return;
                    processedLength = responseText.length;
                    processSSEChunk(chunk);
                }
            });
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                return;
            }
            console.error('Chat error:', error);
            onUpdate({
                type: 'error',
                error: error.message
            });
            throw error;
        }
    }

    async getAnswer(question) {
        // console.log('Getting answer from LLM agent');
        try {
            const response = await axios.post('/api/v1/llm-agent/chat', {
                question,
                messages: this.messages
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

    // Add method to update messages when receiving assistant response
    updateMessages(assistantMessage) {
        this.messages.push({
            role: 'assistant',
            content: assistantMessage
        });
        // console.log('Added assistant message to history. Current messages:', this.messages);
    }

    // Add method to clear history
    clearHistory() {
        this.messages = [];
        // console.log('Cleared message history:', this.messages);
    }
} 
