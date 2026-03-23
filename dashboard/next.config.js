/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow connection to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
