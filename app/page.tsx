// app/page.tsx
'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import WebSocketStatus from '@/components/WebSocketStatus';
import { getLocalIPByBackend } from '@/utils/network';
import ServiceConnector from "@/components/ServiceConnector";

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
  const [matchingIPs, setMatchingIPs] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // 判断是否为本地环境
  const isLocal = useMemo(() => {
    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    );
  }, []);

  // 动态生成 WebSocket 地址
  const wsUrl = useMemo(() => {
    if (isLocal) {
      if (discoveredIp) {
        return `ws://${discoveredIp}:37521`;
      }
      return '';
    } else {
      return 'wss://ttt.srliy.com/api/backend/heartbeat';
    }
  }, [isLocal, discoveredIp]);

  // 初始化本地IP
  useEffect(() => {
    const fetchLocalIP = async () => {
      const localIp = await getLocalIPByBackend();
      if (localIp && !discoveredIp) {
        setDiscoveredIp(localIp);
        setLocalIP(localIp);
      }
    };
    fetchLocalIP();
  }, [discoveredIp]);

  // 获取服务器IP列表
  useEffect(() => {
    const fetchServerIPs = async () => {
      try {
        const res = await fetch('/api/discover');
        const data = await res.json();
        const serverIPs = data.ips || [];
        setServerIPs(serverIPs);
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          {
            type: 'error',
            message: `获取服务器IP失败: ${err instanceof Error ? err.message : '未知错误'}`,
            timestamp: new Date(),
          },
        ]);
      }
    };
    fetchServerIPs();
  }, []);

  // 计算匹配IP
  useEffect(() => {
    if (localIP && serverIPs.length > 0) {
      const matching = serverIPs.filter((ip) => isSameSubnet(ip, localIP));
      setMatchingIPs(matching);
    }
  }, [localIP, serverIPs]);

  // WebSocket连接管理
  useEffect(() => {
    if (!discoveredIp) return;

    const newSocket = new WebSocket(wsUrl);
    socketRef.current = newSocket;

    newSocket.onopen = () => {
      setConnectionStatus('connected');
      addLog('success', 'WebSocket已连接');
    };

    newSocket.onerror = (error: Event) => {
      const errorMessage = (error as ErrorEvent).message || '未知WebSocket错误';
      setConnectionStatus('disconnected');
      setConnectionError(errorMessage);
      addLog('error', `WebSocket连接错误: ${errorMessage}`);
    };

    newSocket.onclose = () => {
      setConnectionStatus('disconnected');
      setConnectionError('连接已关闭');
      addLog('info', 'WebSocket连接已关闭');
    };

    newSocket.onmessage = (event) => {
      setReceivedMessages((prev) => [...prev, event.data]);
      addLog('info', `收到服务端消息: ${event.data}`);
    };

    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, [discoveredIp, wsUrl]);

  // 辅助方法
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      { type, message, timestamp: new Date() },
    ]);
  };

  const isSameSubnet = (ip1: string, ip2: string): boolean => {
    const parts1 = ip1.split('.');
    const parts2 = ip2.split('.');
    return (
        parts1[0] === parts2[0] &&
        parts1[1] === parts2[1] &&
        parts1[2] === parts2[2]
    );
  };

  // 按钮事件
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

        if (data.ips?.length && data.ips[0] !== discoveredIp) {
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

        {/* ServiceConnector组件 */}
        <ServiceConnector
            onLog={(type, msg) => addLog(type, msg)}
            wsUrl={wsUrl}
        />

        {/* WebSocket状态监控 */}
        <WebSocketStatus
            status={connectionStatus}
            messages={receivedMessages}
            localIP={localIP}
            serverIPs={serverIPs}
            matchingIPs={matchingIPs}
            connectionError={connectionError}
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
