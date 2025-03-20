// components/ServiceConnector.tsx
'use client';
import { useEffect } from 'react';

interface ServiceConnectorProps {
    onLog: (type: 'info' | 'error', message: string) => void;
    wsUrl: string;
}

export default function ServiceConnector({ onLog, wsUrl }: ServiceConnectorProps) {
    useEffect(() => {
        let retries = 0;
        const MAX_RETRIES = 5;
        let wsInstance: WebSocket;

        const connect = () => {
            wsInstance = new WebSocket(wsUrl);

            wsInstance.onopen = () => {
                retries = 0;
                onLog('info', 'WebSocket连接成功');
            };

            wsInstance.onclose = () => {
                if (retries < MAX_RETRIES) {
                    const delay = Math.pow(2, retries) * 1000;
                    setTimeout(connect, delay);
                    retries++;
                    onLog('info', `尝试第 ${retries} 次重连...`);
                }
            };

            wsInstance.onerror = (error) => {
                onLog('error', `连接错误: ${error}`);
            };
        };

        connect();

        return () => {
            wsInstance?.close();
        };
    }, [wsUrl, onLog]);

    return null;
}
