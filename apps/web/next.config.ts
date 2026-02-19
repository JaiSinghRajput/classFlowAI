import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@classflowai/engine', '@classflowai/types', '@classflowai/utils'],
  experimental: {
    optimizePackageImports: ['@classflowai/engine', '@classflowai/utils'],
  },
};

export default nextConfig;
