"use client";
import { useEffect, useState } from "react";
import { getLocalIPByBackend } from "@/utils/network";

const WebSocketStatus = () => {
    const [localIP, setLocalIP] = useState<string | null>(null);
    const [serverIPs, setServerIPs] = useState<string[]>([]);
    const [matchingIPs, setMatchingIPs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 新增：WebSocket连接状态
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        const fetchIPs = async () => {
            try {
                // 获取本地IP
                const localIP = await getLocalIPByBackend();
                if (!localIP || localIP.startsWith("127.")) {
                    throw new Error("无效的本地IP地址");
                }
                setLocalIP(localIP);

                // 获取服务器IP列表
                const res = await fetch("/api/discover");
                const data = await res.json();
                const serverIPs = data.ips || [];
                setServerIPs(serverIPs);

                // 计算匹配的IP
                const matching = serverIPs
                    .filter((ip: string) => typeof ip === 'string')
                    .filter((ip: string) => isSameSubnet(ip, localIP));
                setMatchingIPs(matching);

                setLoading(false);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "未知错误";
                setError(`获取IP信息失败：${errorMessage}，请检查网络连接`);
                setLoading(false);
            }
        };

        fetchIPs();
    }, []);

    // 新增：处理WebSocket连接
    useEffect(() => {
        if (matchingIPs.length > 0) {
            // 尝试连接第一个匹配IP
            const ip = matchingIPs[0];
            const wsUrl = `ws://${ip}:37521`;
            const newWs = new WebSocket(wsUrl);

            newWs.onopen = () => {
                setIsConnected(true);
                setConnectionError(null);
                console.log(`WebSocket连接成功: ${ip}`);
            };

            newWs.onerror = (err) => {
                const errorMessage = (err as ErrorEvent).message || '未知错误';
                setConnectionError(`连接失败: ${errorMessage}`);
                setIsConnected(false);
                // 尝试下一个IP（可选）
                if (matchingIPs.length > 1) {
                  setMatchingIPs(matchingIPs.slice(1));
                }
            };

            newWs.onclose = () => {
                setIsConnected(false);
                setConnectionError("连接已关闭");
            };

            setWs(newWs);
        } else {
            // 没有匹配IP时关闭现有连接
            if (ws) {
                ws.close();
                setWs(null);
                setIsConnected(false);
            }
        }

        // 清理函数：组件卸载时关闭连接
        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [matchingIPs]);

    // 判断网段逻辑保持不变
    const isSameSubnet = (ip1: string, ip2: string): boolean => {
        const parts1 = ip1.split(".");
        const parts2 = ip2.split(".");
        return (
            parts1[0] === parts2[0] &&
            parts1[1] === parts2[1] &&
            parts1[2] === parts2[2]
        );
    };

    return (
        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">网络状态</h2>

            {loading && <div className="text-blue-600">正在检测网络配置...</div>}

            {error && <div className="text-red-600">{error}</div>}

            {/* 展示本地IP */}
            {!loading && localIP && (
                <div>
                    <p className="mb-2 text-green-600">您的局域网IP：</p>
                    <div className="font-mono bg-gray-200 p-2 rounded">
                        {localIP}
                    </div>
                </div>
            )}

            {/* 展示服务器IP列表 */}
            {!loading && serverIPs.length > 0 && (
                <div>
                    <p className="mt-4 mb-2 text-blue-600">服务器IP列表：</p>
                    <ul className="list-disc pl-6">
                        {serverIPs.map((ip, index) => (
                            <li key={index} className="font-mono">
                                {ip}
                                {matchingIPs.includes(ip) && "✅ 同一网段"}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 单独展示匹配IP */}
            {!loading && matchingIPs.length > 0 && (
                <div>
                    <p className="mt-6 mb-2 text-green-600 font-bold">可连接的服务器IP：</p>
                    <ul className="list-disc pl-6">
                        {matchingIPs.map((ip, index) => (
                            <li key={index} className="font-mono bg-green-100 p-1 rounded">
                                {ip}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* WebSocket连接状态 */}
            {!loading && (
                <div className="mt-6">
                    <p className="text-blue-600 mb-2">WebSocket连接状态：</p>
                    {isConnected && (
                        <div className="text-green-600">
                            ✅ 已连接到 {matchingIPs[0]}
                        </div>
                    )}
                    {connectionError && (
                        <div className="text-red-600">
                            ❌ {connectionError}
                        </div>
                    )}
                    {!isConnected && !connectionError && (
                        <div className="text-yellow-600">
                            正在尝试连接...
                        </div>
                    )}
                </div>
            )}

            {/* 无匹配IP时的提示 */}
            {!loading && matchingIPs.length === 0 && serverIPs.length > 0 && (
                <div className="text-yellow-600 mt-4">
                    当前网络无法连接任何服务器IP
                </div>
            )}
        </div>
    );
};

export default WebSocketStatus;
