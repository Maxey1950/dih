/**
 * The browser only ever calls same-origin `/api/...` URLs. Next.js proxies them
 * to the API service at API_ORIGIN (server-side only; never exposed to the
 * browser bundle). NOTE: rewrites are resolved at BUILD time, so set
 * API_ORIGIN when running `next build`. A reverse proxy that routes /api/*
 * straight to the API works too and simply never hits this rewrite.
 */
const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:4000';

const isDev = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode additionally needs eval for HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  sassOptions: {
    // Bootstrap 5.3 / Bootswatch still use @import and legacy color functions.
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // Proxy everything under /api EXCEPT /api/internal/*: the game-server API is
    // machine-to-machine and must be reached directly on the internal network,
    // never through the public website.
    return [{ source: '/api/:path((?!internal(?:/|$)).*)', destination: `${apiOrigin}/api/:path` }];
  },
};

export default nextConfig;
