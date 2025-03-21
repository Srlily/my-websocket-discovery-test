// components/ClientWrapper.tsx
"use client";

import dynamic from "next/dynamic";

const NetworkDiscovery = dynamic(
    () => import("@/components/NetworkDiscovery"),
    {
        ssr: false,
        loading: () => <div>正在初始化本地连接...</div>
    }
);

export default function ClientWrapper() {
    return <NetworkDiscovery />;
}