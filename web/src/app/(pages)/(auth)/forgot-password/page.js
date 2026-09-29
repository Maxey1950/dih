'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, errorMessage } from '../../../../lib/api';

function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authApi.forgotPassword(email);
      setSuccess('If an account uses this email, password reset instructions have been sent.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-6 col-lg-5 col-xl-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Forgot Password</h5>
            </div>
            <div className="card-body">
              {success ? (
                <div className="text-center">
                  <div className="alert alert-success">{success}</div>
                  <Link href="/login" className="btn btn-primary">
                    Return to Login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email Address</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        type="email"
                        className="form-control"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-danger">If you did not register with a valid email, we will not be able to send you a password reset link.</p>
                  </div>

                  {error && <div className="alert alert-danger">{error}</div>}

                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Sending Reset Link...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-envelope me-2"></i>
                          Send Reset Link
                        </>
                      )}
                    </button>
                    <Link href="/login" className="btn btn-outline-secondary">
                      <i className="bi bi-arrow-left me-2"></i>
                      Back to Login
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;