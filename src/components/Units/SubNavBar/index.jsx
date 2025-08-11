import './scoped.css'; // reuse the same stylesheet

// SubNavBar.js
import React from 'react';

import {
    useLocation,
    useNavigate,
} from 'react-router-dom';

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';

function SubNavBar({ activeButton }) {
    const location = useLocation();
    const navigate = useNavigate();

    const handleSearchClick = () => {
        navigate('/', { state: { activeButton: "triplet" } });
    };

    const handleChatClick = () => {
        navigate('/', { state: { activeButton: "llm" } });
    };

    return (
        <div className="sub-navigation-bar">
            <button
                id="subnavbarbutton"
                onClick={handleSearchClick}
                className={activeButton === "triplet" || location.pathname.endsWith("result")
                    ? "active" : "nonactive"}
            >
                <SearchIcon sx={{ fontSize: "clamp(12px, 2vw, 16px)" }} />&nbsp;&nbsp;Search
            </button>
            <button
                id="subnavbarbutton"
                onClick={handleChatClick}
                className={activeButton === "llm" || location.pathname.endsWith("llm-agent")
                    ? "active" : "nonactive"}
            >
                <ChatBubbleOutlineIcon sx={{ fontSize: "clamp(12px, 2vw, 16px)" }} />&nbsp;&nbsp;Chat
            </button>
        </div>
    );
}

export default SubNavBar;
