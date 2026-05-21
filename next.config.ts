import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow large Excel imports (default is 1MB).
      // 50MB ≈ ~80,000 delivery rows.
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
