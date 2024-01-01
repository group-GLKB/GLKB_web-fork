// NavBar.js

import React, { useState, useRef, useEffect } from 'react';
import './scoped.css'; // Make sure to import the CSS file
import MedSchoolLogo from '../../img/MedSchoolLogo.png';

const NavBar = () => {
    const [input, setInput] = useState('');
    const [tags, setTags] = useState([]);
    const inputRef = useRef(null);

    const handleInputChange = (e) => {
        setInput(e.target.textContent);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.trim()) {
                // If there is input, create a bubble
                setTags([...tags, input.trim()]);
                setInput('');
                e.target.textContent = '';
            } else if (tags.length > 0) {
                // If there is no input but there are tags, trigger search
                handleSearch();
            }
        } else if (e.key === 'Backspace' && !input) {
            // Delete the last tag if there is no input
            e.preventDefault();
            setTags(tags.slice(0, -1));
        }
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [tags]);

    const handleSearch = () => {
        // Perform search using the tags array
        console.log('Searching for:', tags);
        // Implement the search logic here
        // Clear the tags if needed after search
        setTags([]);
    };

    return (
        <nav className="navbar">
                <div className="left-section">
                    <div className="logo">
                        <a href="/">
                            <img src={MedSchoolLogo} alt="MedSchoolLogo" />
                        </a>
                    </div>
                    <div className="nav-button">
                        <a href="/">Home</a>
                    </div>
                    <div className="nav-button">
                        <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
                    </div>
                </div>

                <div className="center-section">
                    <div className="search-input" onClick={() => inputRef.current && inputRef.current.focus()}>
                        {tags.map((tag, index) => (
                            <span key={index} className="search-tag">
                                {tag}
                                <span className="delete-tag" onClick={() => setTags(tags.filter((_, i) => i !== index))}>&times;</span>
                            </span>
                        ))}
                        <span
                            ref={inputRef}
                            contentEditable
                            className="editable-input"
                            onInput={handleInputChange}
                            onKeyDown={handleKeyDown}
                            role="textbox"
                            aria-multiline="false"
                        />
                    </div>
                    <button onClick={handleSearch}>Search</button>
                </div>

        </nav>

    );
};

export default NavBar;