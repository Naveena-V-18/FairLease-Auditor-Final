import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ]
  },
  experimental: {
    // This allows the proxy to wait up to 60 seconds for the AI
    proxyTimeout: 60000, 
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;