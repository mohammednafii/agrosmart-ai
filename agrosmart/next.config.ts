import type { NextConfig } from "next";

// Backend URL — set NEXT_PUBLIC_API_URL in Vercel env vars for production.
// Falls back to localhost for local development.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "SAMEORIGIN" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      // ML inference — proxied to FastAPI
      {
        source: "/api/predict/:path*",
        destination: `${API_URL}/predict/:path*`,
      },
      // User profile — proxied to FastAPI (protected endpoint)
      {
        source: "/api/profile",
        destination: `${API_URL}/profile`,
      },
    ];
  },
};

export default nextConfig;
