import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import NavBarWhite from '../Units/NavBarWhite';
import { Spin, Button, message } from 'antd';
import { LLMAgentService } from '../../service/LLMAgent';
import { DeleteOutlined, FileTextOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, RedoOutlined } from '@ant-design/icons';
import './scoped.css';
import systemIcon from '../../img/Asset 1.png';
import ReactMarkdown from 'react-markdown';
import GLKBLogo from '../../img/glkb_dark.jpg';

function LLMAgent() {
    const location = useLocation();
    const [userInput, setUserInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingSteps, setStreamingSteps] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editedMessageContent, setEditedMessageContent] = useState('');
    const messagesEndRef = useRef(null);
    
    // Create a single instance of LLMAgentService that persists across re-renders
    const llmService = React.useMemo(() => new LLMAgentService(), []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, streamingSteps]);

    useEffect(() => {
        if (location.state && location.state.initialQuery && chatHistory.length === 0) {
            const query = location.state.initialQuery;
            handleExampleClick(query);
        }
    }, [location.state]);

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

    const handleEditMessage = (index) => {
        if (chatHistory[index].role === 'user') {
            setEditingMessageIndex(index);
            setEditedMessageContent(chatHistory[index].content);
        }
    };

    const handleSaveEdit = async (index) => {
        if (editedMessageContent.trim() === '') return;
        
        const newChatHistory = [...chatHistory];
        newChatHistory[index] = {
            ...newChatHistory[index],
            content: editedMessageContent
        };
        
        const editedHistory = newChatHistory.slice(0, index + 1);
        setChatHistory(editedHistory);
        
        setEditingMessageIndex(null);
        setEditedMessageContent('');
        
        if (index < newChatHistory.length - 1) {
            setIsLoading(true);
            setIsProcessing(true);
            setStreamingSteps([]);
            
            try {
                const conversationHistory = editedHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                
                await llmService.chat(editedMessageContent, (update) => {
    
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
                                const assistantMessage = {
                                    role: 'assistant',
                                    content: update.answer,
                                    references: parseReferences(update.references),
                                    steps: streamingSteps
                                };
                                return [...prev, assistantMessage];
                            });
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
                }, conversationHistory);
            } catch (error) {
                console.error('Error in chat after edit:', error);
                setChatHistory(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error while processing your edited request. Please try again.',
                    references: [],
                    steps: []
                }]);
            } finally {
                setIsLoading(false);
                setIsProcessing(false);
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingMessageIndex(null);
        setEditedMessageContent('');
    };

    const handleCopyMessage = (content) => {
        navigator.clipboard.writeText(content)
            .then(() => {
                message.success('Content copied to clipboard');
            })
            .catch(err => {
                console.error('Failed to copy content: ', err);
                message.error('Copy failed, please select and copy manually');
            });
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

    const handleExampleClick = async (query) => {
        if (isLoading) return;
        
        const newMessage = {
            role: 'user',
            content: query,
            references: []
        };

        setChatHistory(prev => [...prev, newMessage]);
        setUserInput(''); 
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            const conversationHistory = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            conversationHistory.push({
                role: newMessage.role,
                content: newMessage.content
            });

            await llmService.chat(query, (update) => {
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
            }, conversationHistory);
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

    const handleRegenerateResponse = (userMessageIndex) => {
        if (isLoading) return;
        
        const userMessage = chatHistory[userMessageIndex];
        
        const newChatHistory = chatHistory.slice(0, userMessageIndex + 1);
        setChatHistory(newChatHistory);
        
        setIsLoading(true);
        setIsProcessing(true);
        setStreamingSteps([]);
        
        try {
            const conversationHistory = newChatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            llmService.chat(userMessage.content, (update) => {
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
                            const assistantMessage = {
                                role: 'assistant',
                                content: update.answer,
                                references: parseReferences(update.references),
                                steps: streamingSteps
                            };
                            return [...prev, assistantMessage];
                        });
                        setSelectedMessageIndex(userMessageIndex + 1);
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
            }, conversationHistory);
        } catch (error) {
            console.error('Error in regenerate:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while regenerating the response. Please try again.',
                references: [],
                steps: []
            }]);
        } finally {
            setIsLoading(false);
            setIsProcessing(false);
        }
    };

    const renderMessages = () => {
        return chatHistory.map((message, index) => {
            const isLastUserMessage = index === chatHistory.length - 1 && message.role === 'user';
            const isEditing = index === editingMessageIndex;
            
            return (
                <div key={`message-${index}`} className="message-pair">
                    {/* User message */}
                    {message.role === 'user' && (
                        <div className={`message-wrapper user ${isEditing ? 'editing' : ''}`}>
                            {isEditing ? (
                                <div style={{ width: '100%', maxWidth: '800px', marginLeft: 'auto' }}>
                                    <textarea
                                        className="edit-message-input"
                                        value={editedMessageContent}
                                        onChange={(e) => setEditedMessageContent(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="edit-actions">
                                        <button 
                                            className="edit-action-button cancel-edit-button"
                                            onClick={handleCancelEdit}
                                        >
                                            <CloseOutlined /> Cancel
                                        </button>
                                        <button 
                                            className="edit-action-button save-edit-button"
                                            onClick={() => handleSaveEdit(index)}
                                        >
                                            <CheckOutlined /> Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="message">
                                        {message.content}
                                    </div>
                                    <div className="message-actions">
                                        <div 
                                            className="message-action-button edit-button"
                                            onClick={() => handleEditMessage(index)}
                                            title="Edit message"
                                        >
                                            <EditOutlined />
                                        </div>
                                        <div 
                                            className="message-action-button copy-button"
                                            onClick={() => handleCopyMessage(message.content)}
                                            title="Copy content"
                                        >
                                            <CopyOutlined />
                                        </div>
                                    </div>
                                </>
                            )}
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
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                        <div 
                                            className="message-action-button regenerate-button"
                                            onClick={() => handleRegenerateResponse(index - 1)}
                                            title="Regenerate response"
                                            style={{ backgroundColor: 'transparent', border: 'none' }}
                                            disabled={isLoading}
                                        >
                                            <RedoOutlined />
                                        </div>
                                        <div 
                                            className="message-action-button copy-button"
                                            onClick={() => handleCopyMessage(message.content)}
                                            title="Copy response"
                                            style={{ backgroundColor: 'transparent', border: 'none' }}
                                        >
                                            <CopyOutlined />
                                        </div>
                                    </div>
                                </div>
                                <div className="response-content">
                                    <ReactMarkdown>{message.content}</ReactMarkdown>
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
                                
                                {/* Add example queries section */}
                                {chatHistory.length === 0 && (
                                    <div className="example-queries" style={{ paddingTop: '1rem' }}>
                                        <div className="example-queries-header" style={{ gap: '1rem', marginTop: '2vh' }}>
                                            <div className="logo-container" style={{ marginBottom: '1rem' }}>
                                                <img src={systemIcon} alt="AI" className="system-icon" style={{ width: '60px', height: '60px' }} />
                                                <img src={GLKBLogo} alt="GLKB" className="glkb-logo" style={{ height: '60px' }} />
                                            </div>
                                            <h3>I can help you explore biomedical literature. Here are some examples:</h3>
                                        </div>
                                        <div className="example-query-list" style={{ marginTop: '10px', marginBottom: '10px' }}>
                                            <div className="example-query" 
                                                 onClick={() => handleExampleClick("Who are you?")}
                                                 style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                Who are you?
                                            </div>
                                            <div className="example-query" 
                                                 onClick={() => handleExampleClick("What is the role of BRCA1 in breast cancer?")}
                                                 style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                What is the role of BRCA1 in breast cancer?
                                            </div>
                                            <div className="example-query" 
                                                 onClick={() => handleExampleClick("How many articles about Alzheimer's disease are published in 2020?")}
                                                 style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                How many articles about Alzheimer's disease are published in 2020?
                                            </div>
                                            <div className="example-query" 
                                                 onClick={() => handleExampleClick("What pathways does TP53 participate in?")}
                                                 style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                                What pathways does TP53 participate in?
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="messages-container">
                                    {renderMessages()}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="chat-header">
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
                                    <Button 
                                        icon={<DeleteOutlined />}
                                        onClick={handleClear}
                                        className="clear-button"
                                    >
                                        Clear History
                                    </Button>
                                </div>
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