import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vida/shared'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
