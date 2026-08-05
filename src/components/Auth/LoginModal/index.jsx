import './scoped.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

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

/**
 * Sign-in overlay. Rendered once near the app root and opened from anywhere via
 * `openLoginModal()` so the user never loses the page they were on.
 */
const LoginModal = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [autoTriggerFallback, setAutoTriggerFallback] = useState(false);
  const navigate = useNavigate();
  const {
    login,
    loginWithGoogle,
    isLoginModalOpen,
    closeLoginModal,
  } = useAuth();
  const googleInitializedRef = useRef(false);
  const googleButtonRef = useRef(null);
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isLoginModalOpen) return undefined;
    let isMounted = true;

    loadGoogleIdentityScript()
      .then(() => {
        if (isMounted) setGoogleReady(true);
      })
      .catch(() => {
        if (isMounted) setOauthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isLoginModalOpen]);

  // Reset transient state each time the overlay is dismissed.
  useEffect(() => {
    if (isLoginModalOpen) return;
    setError('');
    setLoading(false);
    setOauthLoading(false);
    setShowGoogleFallback(false);
    setAutoTriggerFallback(false);
  }, [isLoginModalOpen]);

  useEffect(() => {
    if (!isLoginModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeLoginModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isLoginModalOpen, closeLoginModal]);

  const handleGoogleLogin = () => {
    if (oauthLoading) return;

    setError('');

    if (!googleClientId) {
      setError('Google login is not configured.');
      return;
    }

    setOauthLoading(true);
    setShowGoogleFallback(true);
    setAutoTriggerFallback(true);

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

              if (!result.success) {
                setError(result.message);
              }

              setOauthLoading(false);
            }
          });
          googleInitializedRef.current = true;
        }
      })
      .catch(() => {
        setError('Google login failed to load.');
        setOauthLoading(false);
      });
  };

  useEffect(() => {
    if (!isLoginModalOpen) return;
    if (!googleReady || !showGoogleFallback || !googleButtonRef.current || !googleClientId) {
      return;
    }

    if (!googleInitializedRef.current && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            setError('Google login failed. Please try again.');
            return;
          }

          const result = await loginWithGoogle(response.credential);

          if (!result.success) {
            setError(result.message);
          }
        }
      });
      googleInitializedRef.current = true;
    }

    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'continue_with',
      shape: 'rectangular',
      width: 320,
    });
    if (autoTriggerFallback) {
      const button = googleButtonRef.current.querySelector('div[role="button"]');
      if (button) button.click();
      setAutoTriggerFallback(false);
    }
  }, [isLoginModalOpen, googleReady, showGoogleFallback, googleClientId, loginWithGoogle, autoTriggerFallback]);

  const handleContinue = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email);

    if (result.success) {
      closeLoginModal();
      navigate('/verify-code', { state: { email } });
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  if (!isLoginModalOpen) return null;

  return (
    <div
      className="login-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeLoginModal();
      }}
    >
      <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button
          type="button"
          className="login-close"
          aria-label="Close sign in"
          onClick={closeLoginModal}
        >
          &times;
        </button>

        <h2 className="login-title" id="login-modal-title">
          Sign in to unlock the full potential of GLKB
        </h2>

        <p className="login-subtitle">
          New to GLKB? Signing in <strong>automatically creates your account</strong>. No separate sign-up needed.
        </p>

        <div className="google-login-slot">
          {showGoogleFallback ? (
            <>
              <div className="google-fallback-subtitle">Continue in the Google pop-up window</div>
              <div className="google-fallback" ref={googleButtonRef} />
            </>
          ) : (
            <button
              type="button"
              className="oauth-button google-button"
              onClick={handleGoogleLogin}
              disabled={oauthLoading}
            >
              <span className="oauth-icon"><FcGoogle size={20} /></span>
              {oauthLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
          )}
        </div>

        <div className="divider"><span>Or</span></div>

        <form onSubmit={handleContinue}>
          <input
            type="email"
            className="login-input"
            placeholder="sarah@university.edu"
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

        <div className="privacy-text">
          By continuing, you agree to our <a href="/terms">Terms and Conditions</a> and <a href="/privacy-policy">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
