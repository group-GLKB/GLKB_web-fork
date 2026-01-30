import './index.css';
import './utils/axiosConfig'; // Import axios interceptor configuration

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
import TestAuth from './components/TestAuth';
// import LoginPage from './components/Auth/LoginPage';
// import SignupPage from './components/Auth/SignupPage';
// import ProtectedRoute from './components/Auth/ProtectedRoute';
// import { AuthProvider } from './components/Auth/AuthContext';
// import {
//   initGA,
//   trackPageView,
// } from './components/Units/analytics';

import { HelmetProvider } from 'react-helmet-async';

const initState = {
    searchType: ''
}

// Create a wrapper component for analytics
function AppWithAnalytics() {
    const location = useLocation();

    // useEffect(() => {
    //     // Initialize GA when the app starts
    //     initGA();
    // }, []);

    // useEffect(() => {
    //     // Track page views when location changes
    //     trackPageView(location.pathname);
    // }, [location]);

    return (
        <HelmetProvider>
        <Routes>
            <Route path='/search' element={<ResultPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/chat" element={<LLMAgent />} />
            <Route path="/test-auth" element={<TestAuth />} />
            
            {/* Authentication routes - commented out for now */}
            {/* <Route path="/login" element={<LoginPage />} /> */}
            {/* <Route path="/signup" element={<SignupPage />} /> */}
            
            {/* Protected routes - commented out for now */}
            {/* <Route path='/result' element={
                <ProtectedRoute>
                    <ResultPage />
                </ProtectedRoute>
            } />
            <Route path="/" element={
                <ProtectedRoute>
                    <HomePage />
                </ProtectedRoute>
            } />
            <Route path="/about" element={
                <ProtectedRoute>
                    <AboutPage />
                </ProtectedRoute>
            } />
            <Route path="/llm-agent" element={
                <ProtectedRoute>
                    <LLMAgent />
                </ProtectedRoute>
            } /> */}
        </Routes>
        </HelmetProvider>
    );
}


const root = createRoot(document.getElementById('root'));
root.render(
    <Router>
        <AppWithAnalytics />
    </Router>
);

// AuthProvider commented out for now
// root.render(
//     <Router>
//         <AuthProvider>
//             <AppWithAnalytics />
//         </AuthProvider>
//     </Router>
// );

