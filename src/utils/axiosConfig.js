import axios from 'axios';

const Sentry = window.Sentry;

const GUEST_ALLOWED_ENDPOINT_PREFIXES = [
  '/api/v1/tier/guest-me',
  '/api/v1/new-llm-agent/stream',
  '/api/v1/new-llm-agent/chat',
];

const normalizeRequestUrl = (url = '') => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '';
    } catch {
      return url;
    }
  }
  return url;
};

const isGuestAllowedRequest = (url = '') => {
  const normalized = normalizeRequestUrl(url);
  return GUEST_ALLOWED_ENDPOINT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const getStoredAuth = () => {
  const token = localStorage.getItem('access_token');
  const tokenType = localStorage.getItem('token_type') || 'bearer';
  return {
    token,
    tokenType,
    isAuthenticated: Boolean(token),
  };
};

/**
 * Axios Interceptor Setup
 * Automatically includes JWT token in all API requests
 */

// Configure base URL via environment variable (e.g. .env.development / .env.production)
// Prefer deriving API base URL from REACT_APP_API_PROXY_TARGET when available.
const proxyTarget = (process.env.REACT_APP_API_PROXY_TARGET || '').trim().replace(/\/+$/, '');
const derivedApiBaseUrl = proxyTarget ? `${proxyTarget}/reorg-api` : '';
axios.defaults.baseURL = derivedApiBaseUrl || 'https://glkb.dcmb.med.umich.edu/reorg-api';

// Request interceptor to add JWT token to headers
axios.interceptors.request.use(
  (config) => {
    const { token, tokenType, isAuthenticated } = getStoredAuth();

    if (isGuestAllowedRequest(config.url) && !isAuthenticated) {
      if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      return config;
    }
    
    if (token) {
      config.headers.Authorization = `${tokenType} ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors (unauthorized)
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if ((error.response?.status >= 500) && Sentry) {
      Sentry.captureException(error, {
        tags: {
          type: 'api',
        },
        extra: {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          responseData: error.response?.data,
        },
      });
    }
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const { isAuthenticated } = getStoredAuth();
      if (isGuestAllowedRequest(requestUrl) && !isAuthenticated) {
        return Promise.reject(error);
      }

      // Token expired or invalid - clear storage and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      
      // Only redirect if not already on login/signup page
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/signup')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;
