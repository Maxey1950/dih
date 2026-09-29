'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function RootPage() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading) router.replace(isAuthenticated ? '/home' : '/login');
  }, [loading, isAuthenticated, router]);

  return <LoadingSpinner />;
}
