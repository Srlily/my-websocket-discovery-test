import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  /* config options here */
};

module.exports = {
    experimental: {
        appDir: true,
        output: 'export',
        trailingSlash: true, // 解决路由路径问题
        images: {
            unoptimized: true // 禁用图片优化
        }
    },
}
export default nextConfig;
