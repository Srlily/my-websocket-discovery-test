// app/page.tsx
'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import WebSocketStatus from '@/components/WebSocketStatus';
import { discoverServices, getLocalIPByBackend, isValidIP } from '@/utils/network';

type LogEntry = {
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: Date;
};

export default function NetworkTester() {
  const [discoveredIp, setDiscoveredIp] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
      'connecting' | 'connected' | 'disconnected'
  >('disconnected');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [localIP, setLocalIP] = useState<string | null>(null);
  const [serverIPs, setServerIPs] = useState<string[]>([]);
  const [matchingIPs] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 32;

  const [discoveryStatus, setDiscoveryStatus] = useState<'scanning' | 'completed' | 'error'>('completed');
  const [discoveredServicesCount, setDiscoveredServicesCount] = useState(0);

  // 网络辅助函数
  const isSameSubnet = useCallback((ip1: string, ip2: string): boolean => {
    const subnet = (ip: string) => ip.split('.').slice(0, 3).join('.');
    return subnet(ip1) === subnet(ip2);
  }, []);
  // 获取远程服务器列表
  const getRemoteServers = useCallback(async (): Promise<{ user_id: string; ip: string }[]> => {
    try {
      const res = await fetch('/api/remote-servers');
      const data = await res.json();
      return data.servers || [];
    } catch (error) {
      addLog('error', `获取远程服务器失败: ${error}`);
      return [];
    }
  }, []);

  // 判断是否为内网IP
  const isLocalIP = useCallback((ip: string): boolean => {
    return ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  }, []);

  // 初始化服务发现
  useEffect(() => {
    const fetchInitialIPs = async () => {
      try {
        const localIps = await discoverServices();
        const remoteServers = await getRemoteServers();
        const remoteIps = remoteServers.map(s => s.ip);
        const combinedIps = [...new Set([...localIps, ...remoteIps])];
        setServerIPs(combinedIps);
        setDiscoveredServicesCount(combinedIps.length);
      } catch (err) {
        addLog('error', `服务发现失败: ${err}`);
      }
    };
    fetchInitialIPs();
  }, [getRemoteServers]);

  // 定时轮询服务发现
  useEffect(() => {
    const discoveryPoll = setInterval(async () => {
      try {
        setDiscoveryStatus('scanning');
        const ips = await discoverServices();
        setServerIPs(ips);
        setDiscoveredServicesCount(ips.length);
        setDiscoveryStatus('completed');
      } catch (err) {
        setDiscoveryStatus('error');
        addLog('error', `服务发现失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }, 30000);

    return () => clearInterval(discoveryPoll);
  }, []);

  // 自动选择最优IP
  useEffect(() => {
    if (serverIPs.length > 0 && localIP) {
      const validIPs = serverIPs.filter(isValidIP); // 使用外部导入的 isValidIP
      const publicIP = validIPs.find(ip => !isLocalIP(ip));
      const localIPs = validIPs.filter(ip => isSameSubnet(ip, localIP));

      // 优先选择本地IP → 公网IP → 其他有效IP
      const newDiscoveredIp =
          (localIPs.length > 0 ? localIPs[0] : null) ||
          publicIP ||
          validIPs[0];

      if (newDiscoveredIp && newDiscoveredIp !== discoveredIp) {
        setDiscoveredIp(newDiscoveredIp);
        addLog('success', `自动选择服务IP: ${newDiscoveredIp}`);
      }
    }
  }, [serverIPs, localIP, discoveredIp, isLocalIP, isSameSubnet]);

  // 初始化本地IP
  useEffect(() => {
    const fetchLocalIP = async () => {
      const localIp = await getLocalIPByBackend();
      if (localIp) setLocalIP(localIp);
    };
    fetchLocalIP();
  }, []);

  // WebSocket URL 计算
  const wsUrl = useMemo(() => {
    if (!discoveredIp) return '';
    const isLocal = isSameSubnet(discoveredIp, localIP || '');
    return isLocal
        ? `ws://${discoveredIp}:37521`
        : `ws://${discoveredIp}:37521/heartbeat`;
  }, [discoveredIp, localIP, isSameSubnet]);

  // WebSocket 连接管理
  useEffect(() => {
    if (!discoveredIp) return;

    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = async () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      const newSocket = new WebSocket(wsUrl);
      socketRef.current = newSocket;

      newSocket.onopen = () => {
        clearTimeout(reconnectTimer!);
        setConnectionStatus('connected');
        setRetryCount(0);
        addLog('success', `WebSocket已连接到 ${wsUrl}`);
      };

      newSocket.onerror = (error: Event) => {
        const errorMessage = (error as ErrorEvent).message || '未知WebSocket错误';
        const errorType = (error as ErrorEvent).type || '未指定';
        setConnectionError(`错误类型: ${errorType}, 信息: ${errorMessage}`);
        addLog('error', `WebSocket连接错误: ${errorMessage}`);

        if (retryCount < MAX_RETRIES) {
          const timeout = Math.pow(2, retryCount) * 1000;
          reconnectTimer = setTimeout(connect, timeout);
          setRetryCount(prev => prev + 1);
        } else {
          setConnectionStatus('disconnected');
          addLog('error', `已达到最大重试次数(${MAX_RETRIES})`);
        }
      };

      newSocket.onclose = (event) => {
        clearTimeout(reconnectTimer!);
        const closeCode = event.code;
        const reason = event.reason || '无详细信息';

        if (closeCode !== 1000) {
          setConnectionError(`连接关闭代码: ${closeCode}, 原因: ${reason}`);
          addLog('error', `连接意外中断: ${reason}`);
          if (retryCount < MAX_RETRIES) {
            reconnectTimer = setTimeout(connect, 1000);
            setRetryCount(prev => prev + 1);
          }
        } else {
          setConnectionError('连接已关闭');
          addLog('info', 'WebSocket连接已关闭');
          setConnectionStatus('disconnected');
        }
      };

      newSocket.onmessage = (event) => {
        setReceivedMessages(prev => [...prev, event.data]);
        addLog('info', `收到服务端消息: ${event.data}`);
      };
    };

    connect();

    return () => {
      socketRef.current?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [discoveredIp, wsUrl, retryCount]);

  // 日志辅助函数
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  // 测试按钮事件
  const testWebSocket = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addLog('error', 'WebSocket未连接，无法发送测试消息');
      return;
    }
    const message = JSON.stringify({
      text: '测试通知',
      type: 'success',
      promise: '',
    });
    socket.send(message);
    addLog('success', 'WebSocket测试消息已发送');
  };

  const testHttp = async () => {
    if (!discoveredIp) {
      addLog('error', '未发现服务，无法进行HTTP测试');
      return;
    }
    setIsTesting(true);
    addLog('info', `开始HTTP测试...目标IP: ${discoveredIp}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
          `http://${discoveredIp}:37520/backend/ip`,
          { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        const ips = data.ips?.join(', ') || '无可用IP';
        addLog('success', `HTTP测试成功！可用IP地址: ${ips}`);
        if (data.ips?.[0] && data.ips[0] !== discoveredIp) {
          setDiscoveredIp(data.ips[0]);
          addLog('info', `自动设置服务地址为: ${data.ips[0]}`);
        }
      } else {
        addLog('error', `HTTP测试失败，状态码: ${response.status}`);
      }
    } catch (err) {
      addLog('error', `HTTP测试异常: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsTesting(false);
    }
  };

  // 调试输出
  useEffect(() => {
    console.log('当前 discoveredIp:', discoveredIp);
    console.log('生成的 wsUrl:', wsUrl);
  }, [discoveredIp, wsUrl]);

  return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">网络测试工具</h1>

        {/* 手动输入IP */}
        <div className="mb-6">
          <label htmlFor="ipInput" className="block mb-2">
            服务IP地址：
          </label>
          <input
              type="text"
              id="ipInput"
              value={discoveredIp || ''}
              onChange={(e) => setDiscoveredIp(e.target.value)}
              className="p-2 border rounded w-full"
              placeholder="手动输入IP地址"
          />
        </div>

        {/* 按钮组 */}
        <div className="flex gap-4 mb-6">
          <button
              onClick={testWebSocket}
              disabled={isTesting || connectionStatus !== 'connected'}
              className="btn btn-secondary"
          >
            发送WebSocket测试消息
          </button>
          <button
              onClick={testHttp}
              disabled={!discoveredIp || isTesting}
              className="btn btn-accent"
          >
            测试HTTP
          </button>
        </div>

        {/* WebSocket状态监控 */}
        <WebSocketStatus
            status={connectionStatus}
            messages={receivedMessages}
            localIP={localIP}
            serverIPs={serverIPs}
            matchingIPs={matchingIPs}
            connectionError={connectionError}
            discoveryStatus={discoveryStatus}
            discoveredServices={discoveredServicesCount}
        />

        {/* 日志面板 */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">日志</h2>
          <div className="space-y-2">
            {logs.map((log, index) => (
                <div
                    key={index}
                    className={`p-2 rounded ${
                        log.type === 'error' ? 'bg-red-100' :
                            log.type === 'success' ? 'bg-green-100' : 'bg-blue-100'
                    }`}
                >
                  [{log.timestamp.toLocaleTimeString()}] {log.message}
                </div>
            ))}
          </div>
        </div>
      </div>
  );
}
