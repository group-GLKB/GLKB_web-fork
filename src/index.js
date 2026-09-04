import './index.css';
import './utils/axiosConfig'; // Import axios interceptor configuration

import React, { Suspense } from 'react';

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

// import SignupPage from './components/Auth/SignupPage';
// import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './components/Auth/AuthContext';
import HomePage from './components/HomePage';
import AppLayout from './components/Layout';
import ErrorBoundary from './components/Units/ErrorBoundary';
import { SHOW_API_DOCS } from './config/features';

/* Everything past the landing page and the chat is fetched when it is asked for.
 *
 * All of it used to be imported here, so one bundle carried every page and the libraries
 * behind them: the search page alone pulls cytoscape and six of its layout plugins, none of
 * which the chat touches. Pressing Enter on the home page cost ~600ms of blocked main thread
 * before a single frame of the answer, measured at 4x CPU throttle, and that is the moment the
 * reader notices most.
 *
 * HomePage and AppLayout stay eager — they ARE the first paint. So does LLMAgent, which
 * AppLayout mounts: deferring it would move its cost onto the click into chat, which is the
 * one place this is trying to make faster.
 */
const AboutPage = React.lazy(() => import('./components/AboutPage'));
const BlogPost = React.lazy(() => import('./components/Blog/BlogPost'));
const PrivacyPolicy = React.lazy(() => import('./components/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./components/TermsOfService'));
const AccountPage = React.lazy(() => import('./components/AccountPage'));
const ApiDocsPage = React.lazy(() => import('./components/ApiDocs'));
const ApiPage = React.lazy(() => import('./components/ApiPage'));
const LoginRedirect = React.lazy(() => import('./components/Auth/LoginRedirect'));
const VerifyCodePage = React.lazy(() => import('./components/Auth/VerifyCodePage'));
const DebugPage = React.lazy(() => import('./components/Debug'));
const History = React.lazy(() => import('./components/History'));
const Library = React.lazy(() => import('./components/Library'));
const MaintenancePage = React.lazy(() => import('./components/MaintenancePage'));
const ResultPage = React.lazy(() => import('./components/ResultPage'));
const TestAuth = React.lazy(() => import('./components/TestAuth'));

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

const INDEXABLE_PATHS = new Set(['/', '/about', '/blog', '/chat', '/search', '/api-page', '/privacy', '/terms']);
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
                <Suspense fallback={null}>
                <Routes>
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/debug" element={<DebugPage />} />
                    <Route path="*" element={<MaintenancePage />} />
                </Routes>
                </Suspense>
            </HelmetProvider>
        );
    }

    return (
        <HelmetProvider>
            <RouteSeoControl />
            {/* For the routes that sit OUTSIDE AppLayout. Anything inside it suspends against
                the boundary around that layout's Outlet, which keeps the Agent mounted. */}
            <Suspense fallback={null}>
            <Routes>
                <Route path="/debug" element={<DebugPage />} />
                {SHOW_API_DOCS ? (
                    <>
                        <Route path="/api-docs" element={<ApiDocsPage />} />
                        <Route path="/api-docs/:slug" element={<ApiDocsPage />} />
                    </>
                ) : (
                    <Route path="/api-docs/*" element={<Navigate to="/" replace />} />
                )}
                <Route element={<AppLayout />}>
                    <Route path='/search' element={<ResultPage />} />
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    {/* The article list lives on About under "From the Lab". */}
                    <Route path="/blog" element={<Navigate to="/about#from-the-lab" replace />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/api-page" element={<ApiPage />} />
                    {/* LLMAgent is mounted persistently by AppLayout; this route only selects it. */}
                    <Route path="/chat" element={null} />
                    {/* Each conversation has its own address, so a link opens it and a
                        reload keeps it. The id is the backend's `public_id` UUID. */}
                    <Route path="/chat/:publicId" element={null} />
                    <Route path="/history" element={<History />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/test-auth" element={<TestAuth />} />

                    {/* Authentication routes */}
                    <Route path="/login" element={<LoginRedirect />} />
                    <Route path="/verify-code" element={<VerifyCodePage />} />
                    {/* <Route path="/signup" element={<SignupPage />} /> */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
            </Suspense>
        </HelmetProvider>
    );
}


/* The backstop. Message-level boundaries catch a broken card; anything that escapes them
   used to unmount the entire tree and leave a silent white page — transcript, sidebar and
   composer gone at once. Plain elements only: whatever crashed may be a UI library, and
   this screen must not depend on it. */
const rootFallback = (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh',
        fontFamily: 'system-ui, sans-serif', color: '#333', gap: '12px', padding: '24px',
    }}
    >
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Something went wrong.</div>
        <div>The page hit an unexpected error. Reloading will pick up where the server is —
            answers being written are kept there and come back with the page.</div>
        <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
                padding: '8px 20px', fontSize: '14px', cursor: 'pointer',
                border: '1px solid #ccc', borderRadius: '6px', background: '#fff',
            }}
        >
            Reload
        </button>
    </div>
);

const root = createRoot(document.getElementById('root'));
root.render(
    <Router>
        <AuthProvider>
            <ErrorBoundary label="app root" fallback={rootFallback}>
                <AppWithRoutes />
            </ErrorBoundary>
        </AuthProvider>
    </Router>
);

