import React, { useState } from 'react';
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
    
    const llmService = new LLMAgentService();

    const parseReferences = (refs) => {
        if (!refs || !Array.isArray(refs)) return [];
        
        return refs.map(ref => {
            // Each ref is a tuple: [title, pubmed_url, citation_count, year, journal, authors]
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
        if (!userInput.trim()) return;
        
        const newMessage = {
            role: 'user',
            content: userInput,
            references: []
        };

        // Add temporary loading message
        const loadingMessage = {
            role: 'assistant',
            content: <Spin size="small" />,
            references: []
        };

        setChatHistory([...chatHistory, newMessage, loadingMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const response = await llmService.sendQuestion(userInput);
            
            const assistantMessage = {
                role: 'assistant',
                content: response.answer,
                references: parseReferences(response.references)
            };

            // Replace loading message with actual response
            setChatHistory(prev => [...prev.slice(0, -1), assistantMessage]);
            setSelectedMessageIndex(chatHistory.length + 1);

        } catch (error) {
            console.error('Error getting response:', error);
            // Replace loading message with error message
            setChatHistory(prev => [...prev.slice(0, -1), {
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                references: []
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setChatHistory([]);
        setSelectedMessageIndex(null);
    };

    const handleMessageClick = (index) => {
        if (chatHistory[index].role === 'assistant') {
            setSelectedMessageIndex(index);
        }
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
                                    {chatHistory.map((message, index) => (
                                        <div key={index}>
                                            <div className={`message-wrapper ${message.role}`}>
                                                {message.role === 'assistant' && (
                                                    <img src={systemIcon} alt="AI" className="system-icon" />
                                                )}
                                                <div className="message">
                                                    {message.content}
                                                </div>
                                            </div>
                                            {message.role === 'assistant' && message.references?.length > 0 && (
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
                                    ))}
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
                        <form onSubmit={handleSubmit} className="input-form">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Ask a question about the biomedical literature..."
                                className="message-input"
                            />
                            <button type="submit" className="send-button">
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LLMAgent; 