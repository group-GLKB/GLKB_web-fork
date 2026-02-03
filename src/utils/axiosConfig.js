import axios from 'axios';

/**
 * Axios Interceptor Setup
 * Automatically includes JWT token in all API requests
 */

// Configure base URL for deployed environments
// In local dev, setupProxy.js handles the proxying
if (process.env.NODE_ENV === 'production') {
  axios.defaults.baseURL = 'https://glkb.dcmb.med.umich.edu/reorg-api';
}

// Request interceptor to add JWT token to headers
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    const tokenType = localStorage.getItem('token_type') || 'bearer';
    
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
    if (error.response?.status === 401) {
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
