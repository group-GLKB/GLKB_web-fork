import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import HomePage from './components/HomePage'
import AboutPage from './components/AboutPage'
import { Provider } from 'react-globally'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import ResultPage from './components/ResultPage'
import { Result } from 'antd'
import { initGA, trackPageView } from './components/Units/analytics';

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
        </Routes>
    );
}

ReactDOM.render(
    <Router>
        <AppWithAnalytics />
    </Router>,
    document.getElementById('root')
)
