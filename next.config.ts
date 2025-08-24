import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Force cache bust - update timestamp: 2025-08-23-22:15
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },

   eslint: {
    // Warning: This allows production builds to successfully complete even if your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // NO X-Frame-Options header - allow all embedding
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Explicitly prevent X-Frame-Options from being set
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      }
    ]
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allows all HTTPS domains
      },
    ],
    domains: [
      'res.cloudinary.com',
      'imagedelivery.net', 
      'cdn.stamp.fyi',
      'i.imgur.com',
      'api.dicebear.com',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
    ],
  },
}

export default nextConfig