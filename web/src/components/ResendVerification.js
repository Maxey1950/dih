'use client';

import { useState } from 'react';
import { authApi, errorMessage } from '../lib/api';

export default function ResendVerification({ email: initialEmail, onClose }) {
    const [email, setEmail] = useState(initialEmail || '');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await authApi.resendVerification(email);
            setSuccess('If this email is registered and unverified, a new verification link will be sent.');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-content">
            <div className="modal-header">
                <h5 className="modal-title">Resend Verification Email</h5>
                {onClose && (
                    <button type="button" className="btn-close" onClick={onClose}></button>
                )}
            </div>
            <div className="modal-body">
                {success ? (
                    <div className="alert alert-success">{success}</div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label">Email Address</label>
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
                        {error && <div className="alert alert-danger">{error}</div>}
                        <div className="d-grid">
                            <button type="submit" className="btn btn-primary" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" />
                                        Sending...
                                    </>
                                ) : (
                                    'Resend Verification Email'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}