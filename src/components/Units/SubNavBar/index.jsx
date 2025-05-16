// SubNavBar.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './scoped.css'; // reuse the same stylesheet

function SubNavBar({ activeButton }) {
    const location = useLocation();
    const navigate = useNavigate(); 

    const handleSearchClick = () => {
        navigate('/', { state: { activeButton: "triplet" }});
    };

    const handleChatClick = () => {
        navigate('/', { state: { activeButton: "llm" }});
    };

    return (
        <div className="sub-navigation-bar">
            <button
                onClick={handleSearchClick}
                className={activeButton === "triplet" || location.pathname.endsWith("result")
                    ? "active" : "nonactive"}
            >
                Search
            </button>
            <button
                onClick={handleChatClick}
                className={activeButton === "llm" || location.pathname.endsWith("llm-agent")
                    ? "active" : "nonactive"}
            >
                Chat
            </button>
        </div>
    );
}

export default SubNavBar;
