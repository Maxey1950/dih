'use client';

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="d-flex justify-content-center align-items-center bg-body-tertiary">
            <div className="container-fluid py-5">
                <div className="card shadow-lg border-0 mx-auto overflow-hidden" style={{ maxWidth: '800px' }}>
                    <div className="card-header bg-primary text-white p-4">
                        <h1 className="display-6 mb-0 fw-bold">404 - Page Not Found</h1>
                    </div>
                    <div className="card-body p-5">
                        <div className="row align-items-center">
                            <div className="col-md-6 text-md-start mb-4 mb-md-0">
                                <h2 className="h3 mb-3 text-primary">Oops!</h2>
                                <p className="lead mb-4 text-muted">The page you are looking for might have been moved or doesn&apos;t exist.</p>
                                <div className="d-flex gap-3">
                                    <Link href="/" className="btn btn-primary px-4 py-2 d-flex align-items-center">
                                        <i className="bi bi-house-fill me-2"></i>
                                        Return Home
                                    </Link>
                                    <button onClick={() => window.history.back()} className="btn btn-outline-primary px-4 py-2 d-flex align-items-center">
                                        <i className="bi bi-arrow-left me-2"></i>
                                        Go Back
                                    </button>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="p-4 text-center">
                                    <img src="/images/doom-confused.png" alt="404 Error Illustration" className="img-fluid rounded" style={{ maxHeight: '300px' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer bg-primary bg-opacity-10 p-4 text-center">
                        <p className="text-muted mb-0">
                            <i className="bi bi-info-circle me-2"></i>
                            If you believe this is an error, please visit the <Link href="/help" className="text-body-secondary underline">Help Center</Link>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}