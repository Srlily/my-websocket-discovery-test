import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // 1. 动态 output 模式（根据环境变量切换）
    output: process.env.BUILD_TYPE === 'local' ? undefined : 'export',

    // 2. 配置 Webpack 处理 YAML 文件
// { isServer }
    webpack: (config) => {
        config.module.rules.push({
            test: /\.yaml$/,
            use: 'yaml-loader',
        });
        return config;
    },

    // 3. 图片配置（直接放在顶层）
    images: {
        unoptimized: true, // 禁用 Next.js 图片优化
    },

};

export default nextConfig;
