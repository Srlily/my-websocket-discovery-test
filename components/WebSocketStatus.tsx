// components/WebSocketStatus.tsx
import React from 'react';

interface WebSocketStatusProps {
    status: 'connecting' | 'connected' | 'disconnected';
    messages: string[];
    localIP: string | null;
    serverIPs: string[];
    connectionError: string | null;
    discoveryStatus: string;
    discoveredServices: number;
}

export default function WebSocketStatus({
                                            status,
                                            messages,
                                            localIP,
                                            serverIPs,
                                            connectionError,
                                        }: WebSocketStatusProps) {
    return (
        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">网络状态</h2>

            {/* 本地IP展示 */}
            {localIP && (
                <div>
                    <p className="mb-2 text-green-600">您的局域网IP：</p>
                    <div className="font-mono bg-gray-200 p-2 rounded">{localIP}</div>
                </div>
            )}

            {/* 服务器IP列表 */}
            {serverIPs.length > 0 && (
                <div className="mt-4">
                    <p className="text-blue-600 mb-2">可用服务IP列表：</p>
                    <ul className="list-disc pl-6">
                        {serverIPs.map((ip, index) => (
                            <li key={index} className="font-mono">
                                {ip}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* WebSocket状态 */}
            <div className="mt-6">
                <p className="text-blue-600 mb-2">WebSocket连接状态：</p>
                {status === 'connected' && (
                    <div className="text-green-600">✅ 已连接</div>
                )}
                {connectionError && (
                    <div className="text-red-600">❌ {connectionError}</div>
                )}
                {status === 'connecting' && (
                    <div className="text-yellow-600">正在尝试连接...</div>
                )}
            </div>

            {/* 消息展示 */}
            <div className="mt-6">
                <h3 className="text-sm mb-2">最近接收的消息（最多5条）</h3>
                <ul>
                    {messages.slice(-5).map((msg, index) => (
                        <li key={index} className="mb-1 break-all">
                            {msg}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
