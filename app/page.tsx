// app/page.tsx
import ClientWrapper from "@/components/ClientWrapper";

export default function Home() {
    return (
        <main className="container">
            <h1>本地服务控制器</h1>
            <ClientWrapper />
        </main>
    );
}