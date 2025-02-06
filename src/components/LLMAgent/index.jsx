import React, { useState, useEffect, useRef } from 'react';
import NavBarWhite from '../Units/NavBarWhite';
import { Spin, Button } from 'antd';
import { LLMAgentService } from '../../service/LLMAgent';
import { DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import './scoped.css';
import systemIcon from '/var/www/glkb/KGFrontend-cp/src/img/Asset 1.png';

function LLMAgent() {
    const [userInput, setUserInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingSteps, setStreamingSteps] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef(null);
    
    // Create a single instance of LLMAgentService that persists across re-renders
    const llmService = React.useMemo(() => new LLMAgentService(), []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, streamingSteps]);

    const parseReferences = (refs) => {
        if (!refs || !Array.isArray(refs)) return [];
        
        return refs.map(ref => {
            const [title, pubmed_url, citation_count, year, journal, authors] = ref;
            return {
                title: title,
                url: pubmed_url,
                citation_count: citation_count,
                year: year,
                journal: journal,
                authors: Array.isArray(authors) ? authors.join(', ') : 'Authors not available'
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;
        
        // Create new user message
        const newMessage = {
            role: 'user',
            content: userInput,
            references: []
        };

        // Update chat history with user message
        setChatHistory(prev => [...prev, newMessage]);
        setUserInput('');
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            // Convert chat history to format expected by backend
            const conversationHistory = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add current message to history
            conversationHistory.push({
                role: newMessage.role,
                content: newMessage.content
            });

            await llmService.chat(userInput, (update) => {
                switch (update.type) {
                    case 'step':
                        setStreamingSteps(prev => {
                            const newSteps = [...prev];
                            const cleanContent = update.content.replace(/\u001b\[\d+m/g, '').trim();
                            if (cleanContent) {
                                newSteps.push({
                                    step: update.step,
                                    content: cleanContent
                                });
                            }
                            return newSteps;
                        });
                        break;
                    case 'final':
                        setIsProcessing(false);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                steps: streamingSteps
                            };
                            newHistory.push(assistantMessage);
                            
                            // Update the LLMAgentService's internal message history
                            llmService.updateMessages(update.answer);
                            
                            return newHistory;
                        });
                        setSelectedMessageIndex(chatHistory.length + 1);
                        break;
                    case 'error':
                        setIsProcessing(false);
                        setChatHistory(prev => [...prev, {
                            role: 'assistant',
                            content: `Error: ${update.error}`,
                            references: [],
                            steps: []
                        }]);
                        break;
                }
            }, conversationHistory); // Pass the conversation history to chat method
        } catch (error) {
            console.error('Error in chat:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                references: [],
                steps: []
            }]);
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const handleClear = () => {
        setChatHistory([]);
        setSelectedMessageIndex(null);
        setStreamingSteps([]);
        llmService.clearHistory();
    };

    const handleMessageClick = (index) => {
        if (chatHistory[index].role === 'assistant') {
            setSelectedMessageIndex(index);
        }
    };

    const renderMessages = () => {
        return chatHistory.map((message, index) => {
            const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'user';
            
            return (
                <div key={`message-${index}`} className="message-pair">
                    {/* User message */}
                    {message.role === 'user' && (
                        <div className={`message-wrapper user`}>
                            <div className="message">
                                {message.content}
                            </div>
                        </div>
                    )}

                    {/* Streaming content */}
                    {isLastUserMessage && isProcessing && (
                        <div className="assistant-response">
                            <div className="reasoning-section">
                                <div className="reasoning-header">
                                    <img src={systemIcon} alt="AI" className="system-icon" />
                                    <span>Thinking...</span>
                                    <Spin size="small" style={{ marginLeft: '8px' }} />
                                </div>
                                <div className="reasoning-content">
                                    {streamingSteps.map((step, stepIndex) => (
                                        <div key={stepIndex} className="step-item">
                                            <strong>{step.step}: </strong>
                                            <span>{step.content}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assistant final response */}
                    {message.role === 'assistant' && (
                        <div className="assistant-response">
                            <div className="response-section">
                                <div className="response-header">
                                    <img src={systemIcon} alt="AI" className="system-icon" />
                                    <span>Response</span>
                                </div>
                                <div className="response-content">
                                    {message.content}
                                </div>
                                {message.references?.length > 0 && (
                                    <div className="reference-button-wrapper">
                                        <Button
                                            icon={<FileTextOutlined />}
                                            className={`reference-button ${selectedMessageIndex === index ? 'selected' : ''}`}
                                            onClick={() => handleMessageClick(index)}
                                        >
                                            {message.references.length} References
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="result-container">
            <div className="navbar-wrapper">
                <NavBarWhite />
            </div>
            <div className="main-content">
                <div className='result-content'>
                    <div className="llm-agent-container">
                        <div className="chat-and-references">
                            <div className="chat-container">
                                <div className="chat-header">
                                    <Button 
                                        icon={<DeleteOutlined />}
                                        onClick={handleClear}
                                        className="clear-button"
                                    >
                                        Clear History
                                    </Button>
                                </div>
                                <div className="messages-container">
                                    {renderMessages()}
                                    <div ref={messagesEndRef} />
                                </div>
                                
                                <form onSubmit={handleSubmit} className="input-form">
                                    <input
                                        type="text"
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        placeholder="Ask a question about the biomedical literature..."
                                        className="message-input"
                                        disabled={isLoading}
                                    />
                                    <button 
                                        type="submit" 
                                        className="send-button" 
                                        disabled={isLoading || !userInput.trim()}
                                    >
                                        Send
                                    </button>
                                </form>
                            </div>
                            
                            <div className="references-container">
                                <h3>References</h3>
                                {selectedMessageIndex !== null && chatHistory[selectedMessageIndex]?.references.length > 0 ? (
                                    <ul className="references-list">
                                        {chatHistory[selectedMessageIndex].references.map((ref, index) => (
                                            <li key={index} className="reference-item">
                                                <h4>{ref.title}</h4>
                                                <p className="reference-metadata">
                                                    {ref.journal} ({ref.year}) | Citations: {ref.citation_count}
                                                </p>
                                                <p className="reference-authors">{ref.authors}</p>
                                                {ref.url && (
                                                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                                                        Read More on PubMed
                                                    </a>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No references available for this response.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LLMAgent; 