'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, errorMessage } from '../../../../lib/api';

function ResetPassword() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Validate token presence
    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new password reset.');
        }
    }, [token]);


    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Reset states
            setError('');
            setSuccess('');
            
            // Validations
            if (!token) {
              setError('Invalid reset link. Please request a new password reset.');
              return;
            }
      
            if (newPassword.length < 8) {
              setError('Password must be at least 8 characters long');
              return;
            }
      
            if (newPassword !== confirmPassword) {
              setError('Passwords do not match');
              return;
            }
      
            setLoading(true);
      
            await authApi.resetPassword({ token, newPassword });

            setSuccess('Password reset successful! Redirecting to login...');
            
            
            setTimeout(() => {
              router.push('/login');
            }, 3000);
          } catch (err) {
            setError(errorMessage(err, 'Failed to reset password. Please try again or request a new reset link.'));
          } finally {
            setLoading(false);
          }
        };

    // Show error state if no token
    if (!token) {
        return (
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <div className="alert alert-danger">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Invalid reset link. Please request a new password reset.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-5">
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="card shadow">
                        <div className="card-body p-4">
                            <h2 className="text-center mb-4">Reset Password</h2>

                            {error && (
                                <div className="alert alert-danger">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="alert alert-success">
                                    <i className="bi bi-check-circle me-2"></i>
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                    <small className="text-muted">
                                        Password must be at least 6 characters long
                                    </small>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Confirm Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-100"
                                    disabled={loading}
                                >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
