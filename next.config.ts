import type { NextConfig } from "next";

const isExportBuild =
    process.env.NODE_ENV === "production" ||
    process.env.BUILD_TYPE === "deploy";

const nextConfig: NextConfig = {
    output: isExportBuild ? "export" : undefined,
    devServer: {
        host: "0.0.0.0",
        port: 3000,
    },
    images: {
        unoptimized: true,
    },
};

export default nextConfig;