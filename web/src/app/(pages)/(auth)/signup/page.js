'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '../../../../contexts/AuthContext';
import { errorMessage } from '../../../../lib/api';
import RequireAuth from '../../../../components/auth/RequireAuth';
import { siteConfig } from '../../../../../config/site';

function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Never log formData: it contains the password.
    try {
      await register({ username: formData.username, password: formData.password });
      setFormData({ username: '', password: '', confirmPassword: '' });
      setSuccess('Account created! Redirecting...');
      router.replace('/home');
    } catch (err) {
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5" style={{backgroundImage: 'url("/images/rollercoaster.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed', minHeight: '100vh'}}>
      <div className="row justify-content-center">

        <div className="col-12 col-sm-10 col-md-12 col-lg-10 col-xl-8 mb-4">
          <div className="alert alert-dismissible alert-info">
            <h4 className="alert-heading">Important Security Information</h4>
            <p className="mb-0">Accounts from the previous site are not carried over. We never ask for your email, and your password is stored only as a secure one-way hash.</p>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-6 col-lg-5 col-xl-4">
            <div className="card shadow mb-4">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">What is {siteConfig.name}?</h5>
              </div>
              <div className="card-body">
              <p className="lead">Create an account and socialize with each other using the forums and message system</p>
              <ul className="list-unstyled">
                  <li><i className="bi bi-chat-dots me-2"></i>Join discussions on various topics</li>
                  <li><i className="bi bi-share me-2"></i>Share your creations and ideas</li>
                  <li><i className="bi bi-people me-2"></i>Connect with like-minded individuals</li>
                </ul>
                <p className="lead mt-4">Customize your character with the items found in the Catalog</p>
                <ul className="list-unstyled">
                  <li><i className="bi bi-palette me-2"></i>Choose from a wide range of clothing and accessories</li>
                  <li><i className="bi bi-person-badge me-2"></i>Create unique looks to express yourself</li>
                  <li><i className="bi bi-star me-2"></i>Collect rare and limited items</li>
                </ul>
                <p className="lead mt-4">Make friends through our friend system</p>
                <ul className="list-unstyled">
                  <li><i className="bi bi-person-plus me-2"></i>Add friends and build your network</li>
                  <li><i className="bi bi-controller me-2"></i>See what your friends are playing</li>
                  <li><i className="bi bi-people-fill me-2"></i>Collaborate on projects together</li>
                </ul>
                <p className="lead mt-4">Play games with each other, privately and publicly</p>
                <ul className="list-unstyled mb-4">
                  <li><i className="bi bi-globe me-2"></i>Explore user-created worlds and experiences</li>
                  <li><i className="bi bi-lock me-2"></i>Host private game sessions with friends</li>
                  <li><i className="bi bi-trophy me-2"></i>Compete in public servers and climb leaderboards</li>
                </ul>
                <img src="/images/herocity.jpg" alt={`Welcome to ${siteConfig.name}`} className="img-fluid rounded" />
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-10 col-md-6 col-lg-5 col-xl-4">
            <div className="card shadow mb-4">
              <div className="card-header bg-warning text-white">
                <h5 className="mb-0">Security Information</h5>
              </div>
              <div className="card-body">
                <ul className="list mb-0">
                  <li><i className="bi bi-shield-check me-2"></i>We will never ask for your password via email, phone, or social media</li>
                  <li><i className="bi bi-eye-slash me-2"></i>Your password is protected and private</li>
                  <li><i className="bi bi-lock me-2"></i>Keep your account information confidential and never share it with others</li>
                </ul>
                <div className="mt-3">
                Your security is our top priority. Please use common sense when using our website
                </div>
              </div>
            </div>

            <div className="card shadow">
            <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Sign Up</h5>
              </div>
              <div className="card-body p-4">
                {error && ( <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                  </div>
                )}
                {success && ( <div className="alert alert-success alert-dismissible fade show" role="alert">
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
                        <input placeholder='Choose a username' type="text" className="form-control" id="username" autoComplete="username" maxLength={20} value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required />
                      </div>
                      <div className="form-text">3-20 characters: letters, numbers and at most one underscore</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="password" className="form-label">Password</label>
                      <div className="input-group">
                        <span className="input-group-text"><i className="bi bi-lock"></i></span>
                        <input placeholder='******' type="password" className="form-control" id="password" autoComplete="new-password" minLength={8} maxLength={128} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                      </div>
                      <div className="form-text">Minimum 8 characters</div>
                    </div>
                    <div className="col-md-6 mb-4">
                      <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                      <div className="input-group">
                        <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                        <input placeholder='******' type="password" className="form-control" id="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required />
                      </div>
                      <div className="form-text">Confirm your password</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-12">
                      <div className="d-flex align-items-center justify-content-between gap-3">
                        <button type="submit" className="btn btn-success flex-grow-1" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Creating Account...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-person-plus me-2"></i>
                              Sign Up
                            </>
                          )}
                        </button>
                        <div className="text-center">or</div>
                        <Link href="/login" className="btn btn-primary flex-grow-1">
                          <i className="bi bi-box-arrow-in-right me-2"></i>
                          Login
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="form-group mt-3">
                    <p className="text-muted">
                      This site is protected by reCAPTCHA and the Google{' '}
                      <a href="https://policies.google.com/privacy">Privacy Policy</a>{' '}
                      and{' '}
                      <a href="https://policies.google.com/terms">Terms of Service</a>{' '}
                      apply.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <RequireAuth guestOnly>
      <SignupPage />
    </RequireAuth>
  );
}