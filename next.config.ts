// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "export",
    images: {
        unoptimized: true,
    },
    // 添加WebSocket协议支持
    experimental: {
        webpackBuildWorker: true,
    },
};

export default nextConfig;