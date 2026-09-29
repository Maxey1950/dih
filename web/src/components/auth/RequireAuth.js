'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../LoadingSpinner';

/**
 * Client-side navigation guard (UX only). Real authorization is always
 * enforced by the API; hiding a page here is not a security boundary.
 *
 * - default: requires a logged-in user, otherwise redirects to /login
 * - guestOnly: redirects logged-in users to /home (login/signup pages)
 * - role: additionally requires user.role === role (admin shell)
 */
export default function RequireAuth({ children, guestOnly = false, role }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = guestOnly ? !isAuthenticated : isAuthenticated && (!role || user?.role === role);

  useEffect(() => {
    if (loading || allowed) return;
    if (guestOnly) {
      router.replace('/home');
    } else if (!isAuthenticated) {
      router.replace(`/login?returnUrl=${encodeURIComponent(pathname)}`);
    } else {
      router.replace('/forbidden');
    }
  }, [loading, allowed, guestOnly, isAuthenticated, router, pathname]);

  if (loading || !allowed) return <LoadingSpinner />;
  return children;
}
