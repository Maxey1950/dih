'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi } from '../../../../lib/api';

function VerifyEmail() {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch {
        setStatus('error');
      }
    };

    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
    }
  }, [token, router]);

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="card shadow-sm border-0" style={{ maxWidth: '400px' }}>
        <div className="card-body text-center p-5">
          {status === 'verifying' && (
            <>
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h5>Verifying your email...</h5>
            </>
          )}

          {status === 'success' && (
            <>
              <i className="bi bi-check-circle text-success" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Email Verified Successfully!</h5>
              <p className="text-muted">Redirecting to login page...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <i className="bi bi-x-circle text-danger" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Verification Failed</h5>
              <p className="text-muted">The verification link is invalid or has expired.</p>
              <button 
                className="btn btn-primary mt-3"
                onClick={() => router.push('/login')}
              >
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
