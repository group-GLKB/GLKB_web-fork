import './scoped.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { FaApple } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../AuthContext';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise;

const loadGoogleIdentityScript = () => {
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Google script failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed to load.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const googleInitializedRef = useRef(false);
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let isMounted = true;

    loadGoogleIdentityScript().catch(() => {
      if (isMounted) {
        setOauthLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleLogin = () => {
    if (oauthLoading) return;

    setError('');

    if (!googleClientId) {
      setError('Google login is not configured.');
      return;
    }

    setOauthLoading(true);

    loadGoogleIdentityScript()
      .then(() => {
        if (!window.google?.accounts?.id) {
          setError('Google login failed to initialize.');
          setOauthLoading(false);
          return;
        }

        if (!googleInitializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              if (!response?.credential) {
                setError('Google login failed. Please try again.');
                setOauthLoading(false);
                return;
              }

              const result = await loginWithGoogle(response.credential);

              if (result.success) {
                navigate('/');
              } else {
                setError(result.message);
              }

              setOauthLoading(false);
            }
          });
          googleInitializedRef.current = true;
        }

        window.google.accounts.id.prompt((notification) => {
          const dismissed = typeof notification.isDismissedMoment === 'function'
            ? notification.isDismissedMoment()
            : false;
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || dismissed) {
            setOauthLoading(false);
            if (!dismissed) {
              setError('Google login was cancelled or blocked.');
            }
          }
        });
      })
      .catch(() => {
        setError('Google login failed to load.');
        setOauthLoading(false);
      });
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple OAuth
    console.log('Apple login clicked');
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email);

    if (result.success) {
      // Navigate to verification page with email
      navigate('/verify-code', { state: { email } });
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <>
      <div className="login-page-container">
        <div className="login-modal">
          <button
            type="button"
            className="login-close"
            aria-label="Close login"
            onClick={handleClose}
          >
            &times;
          </button>
          <h2 className="login-title">Sign in below to unlock the full potential of GLKB</h2>

          <p className="login-subtitle">New to GLKB? An account will be <strong>automatically created</strong> for you upon your first sign-in.</p>

          <button
            type="button"
            className="oauth-button google-button"
            onClick={handleGoogleLogin}
            disabled={oauthLoading}
          >
            <span className="oauth-icon"><FcGoogle size={24} /></span>
            {oauthLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <button type="button" className="oauth-button apple-button" onClick={handleAppleLogin}>
            <span className="oauth-icon"><FaApple size={24} /></span>
            Continue with Apple
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <form onSubmit={handleContinue}>
            <input
              type="email"
              className="login-input"
              placeholder="sarah@yahoo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="continue-button"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>

          {/* <div className="sso-text">
            Single sign-on (SSO)
          </div> */}

          <div className="privacy-text">
            By clicking continuing, you agree to our <a href="/privacy-policy">privacy policy</a>.
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
