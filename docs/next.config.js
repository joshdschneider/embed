/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'frame-ancestors',
            value: '*',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
