import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: { position: 'top-right' },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  // Next.js 16 uses Turbopack by default; empty config silences webpack/Turbopack mismatch warning
  turbopack: {},
};

export default nextConfig;
