'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireAuth from '../../../../../components/auth/RequireAuth';
import { useAuth } from '../../../../../contexts/AuthContext';
import { messagesApi, usersApi, errorMessage } from '../../../../../lib/api';

function ComposeMessagePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [receiverUsername, setReceiverUsername] = useState('');

    const [formData, setFormData] = useState({
        subject: '',
        content: ''
    });

    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReceiverUsername = async () => {
            if (!params.userId) return;
            if (user && String(params.userId) === String(user.id)) {
                setError('Cannot send message to yourself');
                return;
            }
            try {
                const data = await usersApi.get(params.userId);
                if (!data?.user) throw new Error('User not found');
                setReceiverUsername(data.user.username);
            } catch (err) {
                setError(errorMessage(err, 'Recipient not found'));
                setLoading(false);
            }
        };

        fetchReceiverUsername();
    }, [params.userId, user]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (!params.userId) {
            setError('No recipient specified');
            setLoading(false);
            return;
        }

        try {
            await messagesApi.send({
                recipientId: params.userId,
                subject: formData.subject,
                content: formData.content
            });
            setSuccess('Message sent successfully!');
            setFormData({ subject: '', content: '' });
            setTimeout(() => {
                router.back();
            }, 2000);
        } catch (err) {
            setError(errorMessage(err, 'Failed to send message'));
        } finally {
            setLoading(false);
        }
    };

    if (!params.userId) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">
                    No recipient specified
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4 bg-body-tertiary">
            <div className="container">
                {/* Breadcrumb */}
                <nav aria-label="breadcrumb" className="mb-4">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <a href="/my/messages" className="text-decoration-none">Messages</a>
                        </li>
                        <li className="breadcrumb-item active">Compose Message</li>
                    </ol>
                </nav>

                <div className="row">
                    <div className="col-md-8">
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-primary bg-gradient text-white">
                                <h5 className="mb-0">Compose Message</h5>
                            </div>
                            <div className="card-body">
                                {receiverUsername && (
                                    <div className="mb-3 d-flex align-items-center">
                                        <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-3"
                                            style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <i className="bi bi-person text-primary"></i>
                                        </div>
                                        <div>
                                            <span className="text-body-secondary">To:</span>{' '}
                                            <span className="fw-medium">{receiverUsername}</span>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="alert alert-danger py-2">
                                        <i className="bi bi-exclamation-circle-fill me-2"></i>
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="alert alert-success py-2">
                                        <i className="bi bi-check-circle-fill me-2"></i>
                                        {success}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label htmlFor="subject" className="form-label">
                                            Subject
                                        </label>
                                        <input type="text" className="form-control" id="subject" name="subject" value={formData.subject} onChange={handleChange} required maxLength={100} placeholder="Enter message subject" />
                                    </div>

                                    <div className="mb-3">
                                        <label htmlFor="content" className="form-label">
                                            Message
                                        </label>
                                        <textarea className="form-control" id="content" name="content" value={formData.content} onChange={handleChange} required maxLength={2000} rows={8} placeholder="Type your message here..." />
                                        <div className="form-text d-flex justify-content-between align-items-center mt-2">
                                            <span>{formData.content.length}/2000 characters</span>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mt-4">
                                        <button type="button" onClick={() => router.back()} className="btn btn-light">
                                            <i className="bi bi-arrow-left me-2"></i>
                                            Back
                                        </button>
                                        <button type="submit" disabled={loading} className="btn btn-primary px-4">
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-send-fill me-2"></i>
                                                    Send Message
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-4">
                        <div className="card shadow-sm border-0 mb-4">
                            <div className="card-header bg-primary bg-gradient text-white">
                                <h5 className="mb-0">Tips</h5>
                            </div>
                            <div className="card-body">
                                <ul className="list-unstyled mb-0">
                                    <li className="mb-2">
                                        <i className="bi bi-info-circle-fill text-primary me-2"></i>
                                        Keep messages clear and concise
                                    </li>
                                    <li className="mb-2">
                                        <i className="bi bi-shield-check text-primary me-2"></i>
                                        Be respectful and follow community guidelines
                                    </li>
                                    <li>
                                        <i className="bi bi-clock text-primary me-2"></i>
                                        Messages are delivered instantly
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ComposeMessage() {
    return (
        <RequireAuth>
            <ComposeMessagePage />
        </RequireAuth>
    );
}
