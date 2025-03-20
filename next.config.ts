import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // output: process.env.BUILD_TYPE === 'local' ? undefined : 'export',
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
