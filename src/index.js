import './index.css';
import './utils/axiosConfig'; // Import axios interceptor configuration

import React from 'react';

import { createRoot } from 'react-dom/client';
import {
  Helmet,
  HelmetProvider,
} from 'react-helmet-async';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
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
import MaintenancePage from './components/MaintenancePage';
import ResultPage from './components/ResultPage';
import TestAuth from './components/TestAuth';

const RESIZE_OBSERVER_NOISE = [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
];

const isResizeObserverNoise = (message = '') => RESIZE_OBSERVER_NOISE.some((text) => message.includes(text));

if (typeof window !== 'undefined') {
    if (window.ResizeObserver) {
        const NativeResizeObserver = window.ResizeObserver;
        window.ResizeObserver = class ResizeObserver {
            constructor(callback) {
                this._observer = new NativeResizeObserver((entries, observer) => {
                    window.requestAnimationFrame(() => callback(entries, observer));
                });
            }

            observe(target, options) {
                this._observer.observe(target, options);
            }

            unobserve(target) {
                this._observer.unobserve(target);
            }

            disconnect() {
                this._observer.disconnect();
            }
        };
    }

    window.addEventListener('error', (event) => {
        if (isResizeObserverNoise(event?.message)) {
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    }, true);

    window.onerror = (message) => {
        if (isResizeObserverNoise(String(message || ''))) {
            return true;
        }
        return false;
    };

    window.addEventListener('unhandledrejection', (event) => {
        const reasonMessage = String(event?.reason?.message || event?.reason || '');
        if (isResizeObserverNoise(reasonMessage)) {
            event.preventDefault();
        }
    }, true);
}

const initState = {
    searchType: ''
}

const INDEXABLE_PATHS = new Set(['/', '/about', '/chat']);
const MAINTENANCE_MODE = false;

const normalizePathname = (pathname) => {
    const normalized = pathname.replace(/\/+$/, '');
    return normalized || '/';
};

function RouteSeoControl() {
    const location = useLocation();
    const pathname = normalizePathname(location.pathname);
    const isIndexable = INDEXABLE_PATHS.has(pathname);
    const canonicalPath = pathname === '/' ? '' : pathname;

    return (
        <Helmet>
            <meta
                name="robots"
                content={isIndexable ? 'index, follow' : 'noindex, nofollow'}
            />
            <link rel="canonical" href={`https://glkb.org${canonicalPath}`} />
        </Helmet>
    );
}

// Create a wrapper component
function AppWithRoutes() {
    if (MAINTENANCE_MODE) {
        return (
            <HelmetProvider>
                <Routes>
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/debug" element={<DebugPage />} />
                    <Route path="*" element={<MaintenancePage />} />
                </Routes>
            </HelmetProvider>
        );
    }

    return (
        <HelmetProvider>
            <RouteSeoControl />
            <Routes>
                <Route path="/debug" element={<DebugPage />} />
                <Route path="/api-docs/*" element={<Navigate to="/" replace />} />
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

