import './index.css';

import React, { useEffect } from 'react';

import { createRoot } from 'react-dom/client';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import AboutPage from './components/AboutPage';
import HomePage from './components/HomePage';
import LLMAgent from './components/LLMAgent';
import ResultPage from './components/ResultPage';
import {
  initGA,
  trackPageView,
} from './components/Units/analytics';

const initState = {
    searchType: ''
}

// Create a wrapper component for analytics
function AppWithAnalytics() {
    const location = useLocation();

    useEffect(() => {
        // Initialize GA when the app starts
        initGA();
    }, []);

    useEffect(() => {
        // Track page views when location changes
        trackPageView(location.pathname);
    }, [location]);

    return (
        <Routes>
            <Route path='/result' element={<ResultPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/llm-agent" element={<LLMAgent />} />
        </Routes>
    );
}


const root = createRoot(document.getElementById('root'));
root.render(
    <Router>
        <AppWithAnalytics />
    </Router>
);

