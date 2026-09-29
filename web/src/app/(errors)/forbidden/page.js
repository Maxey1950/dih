'use client';

import Link from 'next/link';

export default function Forbidden() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <h1 className="text-9xl font-bold text-yellow-500">403</h1>
                <h2 className="text-2xl font-semibold mt-4">Access Forbidden</h2>
                <p className="mt-2 text-gray-600">You don&apos;t have permission to access this page.</p>
                <Link href="/" className="btn btn-primary mt-6">
                    Return Home
                </Link>
            </div>
        </div>
    );
}