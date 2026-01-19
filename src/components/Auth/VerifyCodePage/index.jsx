import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './scoped.css';
import NavBarWhite from '../../Units/NavBarWhite';
import { MdEmail } from "react-icons/md";

const VerifyCodePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyCode, sendCode } = useAuth();
  
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    const newCode = [...code];
    for (let i = 0; i < digits.length; i++) {
      newCode[i] = digits[i];
    }
    setCode(newCode);
    
    // Focus the next empty input or the last one
    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyCode(email, verificationCode);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
      // Clear the code inputs
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setLoading(false);
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    const result = await sendCode(email);

    if (result.success) {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } else {
      setError(result.message);
    }

    setResendLoading(false);
  };

  const handleChangeEmail = () => {
    navigate('/login');
  };

  return (
    <>
      <NavBarWhite />
      <div className="verify-page-container">
        <div className="verify-modal">
          <div className="email-icon">
            <MdEmail size={48} color="#4169E1" />
          </div>
          
          <h2 className="verify-title">Check your email</h2>
          
          <p className="verify-subtitle">
            To sign in, click the temporary link or enter the 6-digit code we sent to:
          </p>
          
          <div className="email-display">
            <span className="email-text">{email}</span>
            <button className="change-email-button" onClick={handleChangeEmail}>
              Change
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="code-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="code-input"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                />
              ))}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            {resendSuccess && <div className="success-message">Code sent successfully!</div>}
            
            <button 
              type="submit"
              className="submit-button"
              disabled={loading || code.some(d => !d)}
            >
              {loading ? 'Verifying...' : 'Submit'}
            </button>
          </form>
          
          <div className="resend-section">
            <span className="resend-text">Didn't receive the code? </span>
            <button 
              className="resend-button"
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? 'Sending...' : 'Click to resend'}
            </button>
          </div>
          
          <div className="privacy-text">
            By clicking continuing, you agree to our <a href="/privacy-policy">privacy policy</a>.
          </div>
        </div>
      </div>
    </>
  );
};

export default VerifyCodePage;
