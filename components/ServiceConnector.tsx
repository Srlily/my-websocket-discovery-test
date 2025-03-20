// components/ServiceConnector.tsx
'use client';
import { useEffect } from 'react';

interface ServiceConnectorProps {
    onLog: (type: 'info' | 'error', message: string) => void;
    wsUrl: string;
}

export default function ServiceConnector({ onLog, wsUrl }: ServiceConnectorProps) {
    useEffect(() => {
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            onLog('info', `收到服务端消息: ${event.data}`);
        };

        ws.onerror = (error: Event) => {
            const message = (error as ErrorEvent).message || error.toString();
            onLog('error', `WebSocket错误: ${message}`);
        };

        return () => ws.close();
    }, [onLog, wsUrl]);

    return null;
}
