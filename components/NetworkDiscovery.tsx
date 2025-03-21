// components/NetworkDiscovery.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { API_PORT, discoverServer, discoverViaAPI, getClientLocalIPs } from "@/utils/discovery";

const NetworkDiscovery = () => {
    const [status, setStatus] = useState<"init" | "scanning" | "connected" | "error">("init");
    const [serverIP, setServerIP] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const debugInfo = `当前状态：${status} | 服务端IP：${serverIP || '未连接'} | 日志数量：${logs.length}`;
    const addLog = useCallback((message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    }, []);

    const verifyAPIAccess = useCallback(async (ip: string) => {
        try {
            const url = `http://${ip}:${API_PORT}/backend/ip`;
            addLog(`验证API连接: ${url}`);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            addLog(`API验证成功: ${JSON.stringify(data)}`);
        } catch (error) {
            addLog(`API验证失败: ${error instanceof Error ? error.message : "未知错误"}`);
            throw error;
        }
    }, [addLog]);

    const startDiscovery = useCallback(async () => {
        setStatus("scanning");
        addLog("启动服务端发现流程...");

        try {
            // 优先使用WebSocket发现
            const ip = await discoverServer();
            addLog(`发现服务端: ${ip}`);
            await verifyAPIAccess(ip);

            setServerIP(ip);
            setStatus("connected");
            localStorage.setItem("serverIP", ip);
        } catch (error) {
            addLog(`WebSocket发现失败: ${error instanceof Error ? error.message : "未知错误"}`);

            // 回退到API发现
            try {
                addLog("尝试API发现...");
                const localIPs = await getClientLocalIPs();
                const baseIP = localIPs[0]?.split(".").slice(0,3).join(".") || "192.168.1";
                const apiIP = await discoverViaAPI(baseIP);

                addLog(`通过API发现: ${apiIP}`);
                await verifyAPIAccess(apiIP);

                setServerIP(apiIP);
                setStatus("connected");
                localStorage.setItem("serverIP", apiIP);
            } catch (apiError) {
                addLog(`所有发现方式失败: ${apiError instanceof Error ? apiError.message : "未知错误"}`);
                setStatus("error");
            }
        }
    }, [addLog, verifyAPIAccess]);

    useEffect(() => {
        const init = async () => {
            try {
                const cachedIP = localStorage.getItem("serverIP");
                if (cachedIP) {
                    addLog("检测到缓存IP");
                    setServerIP(cachedIP);
                    setStatus("connected");
                    await verifyAPIAccess(cachedIP);
                    return;
                }
                await startDiscovery();
            } catch (error) {
                addLog(`初始化失败: ${error instanceof Error ? error.message : "未知错误"}`);
                setStatus("error");
            }
        };

        // 确保只在客户端执行
        if (typeof window !== "undefined") {
            init();
        }
    }, [addLog, startDiscovery, verifyAPIAccess]);


    return (
        <div className="network-discovery">
            <div className="status">
                {status === 'connected' && (
                    <div className="connected">
                        ✅ 已连接至: {serverIP}
                        <button onClick={() => {
                            localStorage.removeItem('serverIP');
                            window.location.reload();
                        }}>
                            重新扫描
                        </button>
                    </div>
                )}
                {status === 'scanning' && <div className="scanning">🔄 扫描中...</div>}
                {status === 'error' && (
                    <div className="error">
                        ❗ 连接失败
                        <button onClick={startDiscovery}>重试</button>
                        <button onClick={() => {
                            const ip = prompt('请输入服务端 IP:');
                            if (ip) {
                                setServerIP(ip);
                                localStorage.setItem('serverIP', ip);
                                setStatus('connected');
                            }
                        }}>
                            手动输入
                        </button>
                    </div>
                )}
            </div>

            {/* 调试信息展示 */}
            <div className="debug-info">
                <pre>{debugInfo}</pre>
            </div>
        </div>
    );
};

export default NetworkDiscovery;