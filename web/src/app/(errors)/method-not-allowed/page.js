'use client';

import Link from 'next/link'

export default function MethodNotAllowed() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <h1 className="text-9xl font-bold text-purple-500">405</h1>
                <h2 className="text-2xl font-semibold mt-4">Method Not Allowed</h2>
                <p className="mt-2 text-gray-600">The requested method is not supported.</p>
                <Link href="/" className="btn btn-primary mt-6">
                    Return Home
                </Link>
            </div>
        </div>
    );
}