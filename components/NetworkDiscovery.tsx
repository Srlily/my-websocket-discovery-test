// components/NetworkDiscovery.tsx
import {
    useState,
    useEffect,
    useCallback
} from 'react';
import {API_PORT, discoverServer, getClientLocalIPs} from '@/utils/discovery';

const NetworkDiscovery = () => {
    const [status, setStatus] = useState<'init' | 'scanning' | 'connected' | 'error'>('init');
    const [serverIP, setServerIP] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = useCallback((message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    }, []);

    const verifyAPIAccess = useCallback(async (ip: string) => {
        try {
            const url = `http://${ip}:${API_PORT}/backend/ip`;
            addLog(`尝试连接 API: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            addLog(`API 验证成功: ${JSON.stringify(data)}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            addLog(`API 验证失败: ${message}`);
            throw error;
        }
    }, [addLog]);

    const startDiscovery = useCallback(async () => {
        setStatus('scanning');
        addLog('开始服务端发现流程...');

        try {
            const localIPs = await getClientLocalIPs();
            addLog(`检测到本地IP地址: ${localIPs.join(', ')}`); // 显示实际IP

            const ip = await discoverServer();
            addLog(`成功发现服务端: ${ip}`);

            // 验证连接
            await verifyAPIAccess(ip);
            addLog(`服务端验证通过: ${ip}`);

            // 更新状态
            setServerIP(ip);
            setStatus('connected');
            localStorage.setItem('serverIP', ip);

        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            addLog(`发现失败: ${message}`);

            // 显示详细错误信息
            if (message.includes('192.168.1.1')) {
                addLog('检测到错误IP地址，请检查：\n1. 是否连接正确WiFi\n2. 服务端是否启动');
            }

            setStatus('error');
        }
    }, [addLog, verifyAPIAccess]);

    useEffect(() => {
        const init = async () => {
            try {
                const cachedIP = localStorage.getItem('serverIP');
                if (cachedIP) {
                    addLog('检测到缓存 IP');
                    setServerIP(cachedIP);
                    setStatus('connected');
                    await verifyAPIAccess(cachedIP);
                    return;
                }
                await startDiscovery();
            } catch (error) {
                const message = error instanceof Error ? error.message : '未知错误';
                addLog(`初始化失败: ${message}`);
                setStatus('error');
            }
        };

        init();
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

            <div className="debug-console">
                <h4>调试日志</h4>
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