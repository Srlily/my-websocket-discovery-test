// app/page.tsx
import dynamic from "next/dynamic";

const NetworkDiscovery = dynamic(
    () => import("@/components/NetworkDiscovery"),
    {
        ssr: false,
        loading: () => <div>正在初始化本地连接...</div>
    }
);

export default function Home() {
    return (
        <main className="container">
            <h1>本地服务控制器</h1>
            <NetworkDiscovery />
        </main>
    );
}