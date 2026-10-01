// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   reactStrictMode: true,
// };

// export default nextConfig;
// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   reactStrictMode: true,

//   // 🔥 ngrok dev access allow
//   allowedDevOrigins: [
//     "3671-114-130-190-9.ngrok-free.app"
//   ],
// };

// export default nextConfig;

import type { NextConfig } from "next";

const isCpanelBuild = process.env.BUILD_TARGET === 'cpanel' && process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // cPanel deploy: BUILD_TARGET=cpanel next build
  // dev/tunnel:    next dev  (no BUILD_TARGET)
  ...(isCpanelBuild ? { output: 'export', trailingSlash: true } : {}),

  images: {
    unoptimized: true,
  },

  reactStrictMode: process.env.NODE_ENV === 'production',

  // Dev-only mirror of public/.htaccess.
  // Detail pages are prebuilt as a single `/0` shell (dynamicParams=false); the
  // real id is read client-side via useParams. In production Apache rewrites
  // /partners/<id> -> /partners/0/index.html. `next dev` has no Apache, so
  // without this every id except 0 would 404. Ignored by `output: 'export'`,
  // so the cPanel build is unaffected.
  async rewrites() {
    if (isCpanelBuild) return [];
    return [
      { source: '/farm/cattle/:id', destination: '/farm/cattle/0' },
      { source: '/suppliers/:id', destination: '/suppliers/0' },
      { source: '/partners/:id', destination: '/partners/0' },
      { source: '/customers/:id', destination: '/customers/0' },
      { source: '/accounting/payment-accounts/:id', destination: '/accounting/payment-accounts/0' },
      {
        source: '/farm/labour/employees/:id/salary-history',
        destination: '/farm/labour/employees/0/salary-history',
      },
    ];
  },
};

export default nextConfig;