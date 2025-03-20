import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: process.env.BUILD_TYPE === "export" ? "export" : undefined,
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
