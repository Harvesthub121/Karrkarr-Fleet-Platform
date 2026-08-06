import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@karrkarr/shared'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
