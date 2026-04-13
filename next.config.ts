import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // This allows the proxy to wait up to 60 seconds for the AI
    proxyTimeout: 60000, 
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;