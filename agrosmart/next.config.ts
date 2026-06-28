import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // ML inference — proxied to FastAPI
      {
        source: "/api/predict/:path*",
        destination: "http://localhost:8000/predict/:path*",
      },
      // User profile — proxied to FastAPI (protected endpoint)
      {
        source: "/api/profile",
        destination: "http://localhost:8000/profile",
      },
    ];
  },
};

export default nextConfig;
