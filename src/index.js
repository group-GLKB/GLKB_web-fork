import './index.css';
import './utils/axiosConfig'; // Import axios interceptor configuration

import React from 'react';

import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import AboutPage from './components/AboutPage';
import AccountPage from './components/AccountPage';
import ApiPage from './components/ApiPage';
// import SignupPage from './components/Auth/SignupPage';
// import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './components/Auth/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import VerifyCodePage from './components/Auth/VerifyCodePage';
import DebugPage from './components/Debug';
import History from './components/History';
import HomePage from './components/HomePage';
import AppLayout from './components/Layout';
import Library from './components/Library';
import LLMAgent from './components/LLMAgent';
import ResultPage from './components/ResultPage';
import TestAuth from './components/TestAuth';

const initState = {
    searchType: ''
}

// Create a wrapper component
function AppWithRoutes() {
    return (
        <HelmetProvider>
            <Routes>
                <Route path="/debug" element={<DebugPage />} />
                <Route element={<AppLayout />}>
                    <Route path='/search' element={<ResultPage />} />
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/api-page" element={<ApiPage />} />
                    <Route path="/chat" element={<LLMAgent />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/test-auth" element={<TestAuth />} />

                    {/* Authentication routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/verify-code" element={<VerifyCodePage />} />
                    {/* <Route path="/signup" element={<SignupPage />} /> */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
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

