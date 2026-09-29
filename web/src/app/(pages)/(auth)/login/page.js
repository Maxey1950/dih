'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '../../../../contexts/AuthContext';
import { ApiError } from '../../../../lib/api';
import RequireAuth from '../../../../components/auth/RequireAuth';
import ResendVerification from '../../../../components/ResendVerification';
import { siteConfig } from '../../../../../config/site';

/** Only allow same-site relative paths as a post-login redirect target. */
function safeReturnUrl(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/home';
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setShowResendVerification(false);

    // Never log formData: it contains the password.
    try {
      await login({ username: formData.username, password: formData.password });
      setFormData((prev) => ({ ...prev, password: '' }));
      setSuccess('Login successful! Redirecting...');
      router.replace(safeReturnUrl(searchParams.get('returnUrl')));
    } catch (err) {
      setFormData((prev) => ({ ...prev, password: '' }));
      if (err instanceof ApiError && err.status === 429) {
        setError(
          <div>
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <span className="fw-bold">Account Temporarily Locked</span>
            </div>
            <p className="mb-0">{err.message}</p>
          </div>
        );
      } else if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(err.details?.email || '');
        setShowResendVerification(true);
        setError(
          <div>
            <div className="d-flex align-items-center">
              <i className="bi bi-envelope-exclamation me-2"></i>
              <span>Email Not Verified</span>
            </div>
            <p className="mb-0">Please verify your email to continue.</p>
          </div>
        );
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Login is not available yet. The new account system is still being built.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5" style={{ backgroundImage: 'url("/images/rollercoaster.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed', minHeight: '100vh' }}>
      {/* Resend Verification Modal */}
      {showResendVerification && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <ResendVerification 
                email={unverifiedEmail} 
                onClose={() => {
                  setShowResendVerification(false);
                  setError(null);
                }} 
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-6 col-lg-5 col-xl-4">
          <div className="card shadow mb-4">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Login to {siteConfig.name}</h5>
            </div>
            <div className="card-body p-4">
              {/* Error display */}
              {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                  <div className="d-flex align-items-center">
                    <div className="flex-grow-1">{error}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  {success}
                  <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label htmlFor="username" className="form-label">Username</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-person"></i></span>
                      <input 
                        placeholder='Enter your username' 
                        type="text" 
                        className="form-control" 
                        id="username"
                        autoComplete="username" 
                        value={formData.username} 
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-text">Enter your username</div>
                  </div>
                  <div className="col-md-12 mb-4">
                    <label htmlFor="password" className="form-label">Password</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-lock"></i></span>
                      <input 
                        placeholder='******' 
                        type="password" 
                        className="form-control" 
                        id="password"
                        autoComplete="current-password" 
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-text">Enter your password</div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between gap-3">
                      <button type="submit" className="btn btn-success flex-grow-1 w-auto px-4" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Logging In...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-box-arrow-in-right me-2"></i>
                            Login
                          </>
                        )}
                      </button>
                      <div className="text-center">or</div>
                      <Link href="/signup" className="btn btn-primary flex-grow-1 w-auto px-4">
                        <i className="bi bi-person-plus me-2"></i>
                        Sign Up
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="form-group mt-3 text-center">
                  <Link href="/forgot-password">
                    <i className="bi bi-key me-2"></i>
                    Forgot Password?
                  </Link>
                </div>
              </form>
            </div>
          </div>
          <div className="card shadow">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">Security Information</h5>
            </div>
            <div className="card-body">
              <ul className="list mb-0">
                <li><i className="bi bi-shield-check me-2"></i>We will never ask for your password via email, phone, or social media</li>
                <li><i className="bi bi-eye-slash me-2"></i>Your password is protected and private</li>
                <li><i className="bi bi-lock me-2"></i>Keep your account information confidential and never share it with others</li>
              </ul>
              <div className="mt-3">
                Your security is our top priority. Stay vigilant and enjoy a safe experience on {siteConfig.name}!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <RequireAuth guestOnly>
      <Suspense>
        <LoginPage />
      </Suspense>
    </RequireAuth>
  );
}