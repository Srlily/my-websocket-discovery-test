// components/ServiceConnector.tsx
'use client';
import { useEffect } from 'react';

interface ServiceConnectorProps {
    onLog: (type: 'info' | 'error', message: string) => void;
}

export default function ServiceConnector({ onLog }: ServiceConnectorProps) {
    useEffect(() => {
        const ws = new WebSocket('ws://ttt.srliy.com/api/backend/heartbeat');

        ws.onmessage = (event) => {
            onLog('info', `收到服务端心跳: ${event.data}`);
            console.log('Received:', event.data);
        };

        ws.onerror = (error: Event) => {
            const message = (error as ErrorEvent).message || error.toString();
            onLog('error', `WebSocket连接异常: ${message}`);
        };

        return () => ws.close();
    }, [onLog]);

    return null;
}
