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
import LoginPage from './components/Auth/LoginPage';
import VerifyCodePage from './components/Auth/VerifyCodePage';
// import SignupPage from './components/Auth/SignupPage';
// import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './components/Auth/AuthContext';

import { HelmetProvider } from 'react-helmet-async';

const initState = {
    searchType: ''
}

// Create a wrapper component
function AppWithRoutes() {
    return (
        <HelmetProvider>
        <Routes>
            <Route path='/search' element={<ResultPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/chat" element={<LLMAgent />} />
            <Route path="/test-auth" element={<TestAuth />} />
            
            {/* Authentication routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-code" element={<VerifyCodePage />} />
            {/* <Route path="/signup" element={<SignupPage />} /> */}
            
        </Routes>
        </HelmetProvider>
    );
}


const root = createRoot(document.getElementById('root'));
root.render(
    <Router>
        <AuthProvider>
            <AppWithRoutes />
        </AuthProvider>
    </Router>
);

