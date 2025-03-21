// components/NetworkDiscovery.tsx
import { useState, useEffect } from 'react';
import { API_PORT, discoverServer, discoverViaAPI } from '@/utils/discovery';

const NetworkDiscovery = () => {
    const [status, setStatus] = useState<'init' | 'scanning' | 'connected' | 'error'>('init');
    const [serverIP, setServerIP] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const startDiscovery = async () => {
        setStatus('scanning');
        addLog('启动服务端发现流程...');

        try {
            // WebSocket 发现（带进度回调）
            const ip = await discoverServer((progress) => addLog(`[WS扫描] ${progress}`));
            addLog(`通过 WebSocket 发现服务端: ${ip}`);

            // API 验证
            addLog('开始验证 API 接口...');
            await verifyAPIAccess(ip);

            setServerIP(ip);
            setStatus('connected');
            localStorage.setItem('serverIP', ip);
        } catch (error) {
            addLog(`WebSocket 发现失败: ${error.message}`);
            try {
                addLog('尝试 API 发现...');
                const ip = await discoverViaAPI();
                addLog(`通过 API 发现服务端: ${ip}`);

                addLog('开始验证 API 接口...');
                await verifyAPIAccess(ip);

                setServerIP(ip);
                setStatus('connected');
                localStorage.setItem('serverIP', ip);
            } catch (apiError) {
                addLog(`所有自动发现方式失败: ${apiError.message}`);
                setStatus('error');
            }
        }
    };

    const verifyAPIAccess = async (ip: string) => {
        try {
            const url = `http://${ip}:${API_PORT}/backend/ip`;
            addLog(`尝试连接 API: ${url}`);

            const response = await fetch(url);
            addLog(`API 响应状态: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP 状态异常: ${response.status}`);
            }

            const data = await response.json();
            addLog('API 验证成功: ' + JSON.stringify(data));
        } catch (error) {
            addLog(`API 验证失败: ${error.message}`);
            throw error;
        }
    };

    useEffect(() => {
        const initDiscovery = async () => {
            try {
                const cachedIP = localStorage.getItem('serverIP');
                if (cachedIP) {
                    addLog('检测到缓存 IP');
                    setServerIP(cachedIP);
                    setStatus('connected');
                    addLog('使用缓存 IP: ' + cachedIP);

                    // 验证缓存 IP 的有效性
                    addLog('验证缓存 IP...');
                    await verifyAPIAccess(cachedIP);
                } else {
                    await startDiscovery();
                }
            } catch (error) {
                addLog(`初始化失败: ${error.message}`);
                setStatus('error');
            }
        };

        initDiscovery();
    }, []);

    return (
        <div className="network-discovery">
            <div className="status">
                {status === 'connected' && (
                    <div className="connected">
                        ✅ 已连接至: {serverIP}
                        <button onClick={() => {
                            localStorage.removeItem('serverIP');
                            window.location.reload();
                        }}>重新扫描</button>
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
                        }}>手动输入</button>
                    </div>
                )}
            </div>

            <div className="debug-console">
                <h4>调试信息</h4>
                <ul>
                    {logs.map((log, index) => (
                        <li key={index}>{log}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default NetworkDiscovery;
