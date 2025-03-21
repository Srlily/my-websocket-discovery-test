'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import WebSocketStatus from '@/components/WebSocketStatus';
import { discoverServices } from '@/utils/network';

type LogEntry = {
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: Date;
};

export default function NetworkTester() {
  const [discoveredIp, setDiscoveredIp] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
      'connecting' | 'connected' | 'disconnected'
  >('disconnected');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [localIP] = useState<string | null>(null);
  const [serverIPs, setServerIPs] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || '127.0.0.1';

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  // 自动检测本机访问
  useEffect(() => {
    const detectLocalAccess = async () => {
      try {
        const socket = new WebSocket(`ws://${SERVER_IP}:37521`);
        const timeout = setTimeout(() => socket.close(), 3000);

        socket.onopen = () => {
          clearTimeout(timeout);
          setDiscoveredIp(SERVER_IP);
          addLog('success', '检测到本机访问，自动使用服务端IP');
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          addLog('error', '自动检测失败，请手动输入服务IP');
          setDiscoveredIp(null);
        };

        socket.onclose = () => {
          clearTimeout(timeout);
          addLog('error', '自动检测失败，请手动输入服务IP');
          setDiscoveredIp(null);
        };
      } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : String(error) || '未知错误';
        addLog('error', `服务发现失败: ${errorMessage}`);
      }
    };

    detectLocalAccess();
  }, [SERVER_IP]);

  // WebSocket URL 计算
  const wsUrl = useMemo(() => {
    return `ws://${discoveredIp || SERVER_IP}:37521`;
  }, [discoveredIp, SERVER_IP]);

  // WebSocket 连接管理
  useEffect(() => {
    if (!discoveredIp) return;

    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = async () => {  // 移除 retryCount 参数
      if (socketRef.current) socketRef.current.close();
      const newSocket = new WebSocket(wsUrl);
      socketRef.current = newSocket;

      newSocket.onopen = () => {
        clearTimeout(reconnectTimer!);
        setConnectionStatus('connected');
        addLog('success', `WebSocket已连接到 ${wsUrl}`);
      };

      newSocket.onerror = (error: Event) => {
        const errMsg = (error as ErrorEvent).message || '未知错误';
        addLog('error', `WebSocket连接错误: ${errMsg}`);
        setDiscoveredIp(null);
      };

      newSocket.onclose = (event) => {
        if (event.code !== 1000) {
          addLog('error', `连接意外中断: ${event.reason}`);
          setDiscoveredIp(null);
        } else {
          addLog('info', 'WebSocket连接已关闭');
          setConnectionStatus('disconnected');
        }
      };

      newSocket.onmessage = (event) => {
        setReceivedMessages(prev => [...prev, event.data]);
        addLog('info', `收到服务端消息: ${event.data}`);
      };
    };

    // 自动重试逻辑
    const startReconnect = () => {
      reconnectTimer = setTimeout(() => {
        if (!socketRef.current) connect();
      }, 5000);
    };

    connect();
    startReconnect();

    return () => {
      socketRef.current?.close();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [discoveredIp, wsUrl]);

  // 服务发现
  useEffect(() => {
    const fetchIPs = async () => {
      try {
        const ips = await discoverServices();
        setServerIPs(ips);
      } catch (error) {
        addLog('error', `服务发现失败: ${error}`);
      }
    };

    fetchIPs();
  }, []);

  return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">网络测试工具</h1>

        {/* 手动输入IP（仅当未自动检测到时显示）*/}
        {!discoveredIp && (
            <div className="mb-6">
              <div className="text-red-500 mb-2">
                无法自动检测到服务IP，请手动输入：
              </div>
              <label htmlFor="ipInput" className="block mb-2">
                服务IP地址：
              </label>
              <input
                  type="text"
                  id="ipInput"
                  value={discoveredIp || ''}
                  onChange={(e) => setDiscoveredIp(e.target.value)}
                  className="p-2 border rounded w-full"
                  placeholder={SERVER_IP}
              />
            </div>
        )}

        {/* WebSocket状态监控 */}
        <WebSocketStatus
            status={connectionStatus}
            messages={receivedMessages}
            localIP={localIP}
            serverIPs={serverIPs}
            connectionError={null}
            discoveryStatus="completed"
            discoveredServices={serverIPs.length}
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
