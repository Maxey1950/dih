'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error('Error:', error);
    }, [error]);

    return (
        <div className="d-flex justify-content-center align-items-center bg-light">
            <div className="container py-5">
                <div className="card shadow-lg border-0 mx-auto overflow-hidden" style={{ maxWidth: '800px' }}>
                    <div className="card-header bg-primary text-white p-4">
                        <h1 className="display-6 mb-0 fw-bold">500 - Internal Server Error</h1>
                    </div>
                    <div className="card-body p-5">
                        <div className="row align-items-center">
                            <div className="col-md-6 text-md-start mb-4 mb-md-0">
                                <h2 className="h3 mb-3 text-primary">Oops!</h2>
                                <p className="lead mb-4 text-muted">We're sorry, but there was an internal server error.</p>
                                <div className="d-flex gap-3">
                                    <button onClick={reset} className="btn btn-primary">
                                        Try Again
                                    </button>
                                    <Link href="/" className="btn btn-outline-primary">
                                        <i className="bi bi-house-fill me-2"></i>
                                        Return Home
                                    </Link>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="p-4 text-center">
                                    <img src="/images/noob-poking-dynamite.png" alt="404 Error Illustration" className="img-fluid rounded" style={{ maxHeight: '300px' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer bg-primary bg-opacity-10 p-4 text-center">
                        <p className="text-muted mb-0">
                            <i className="bi bi-info-circle me-2"></i>
                            If you believe this is an error, please contact support
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}