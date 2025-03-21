// service-discovery.ts
import {discoverServices} from "@/utils/network";


// 新增IPv6验证
const validateIP = (ip: string): boolean => {
    const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return (ipv4Regex.test(ip) && ip.split('.').every(num => num <= 255)) ||
        ipv6Regex.test(ip);
};

// 新增局域网IP判断
const isLocalIP = (ip: string): boolean => {
    return ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.');
};

export async function discoverWebSocketService(): Promise<string> {
    try {
        // 1. 尝试Bonjour发现
        const bonjourIps = await discoverServices();
        for (const ip of bonjourIps) {
            try {
                const wsUrl = `ws://${ip}:37521`;
                console.log(`Testing IP: ${ip}`);
                if (await testWebSocket(wsUrl)) return wsUrl;
            } catch (e) {
                console.error(`IP ${ip} 连接失败: ${e.message}`);
            }
        }

        // 2. 尝试SSDP
        try {
            const ssdpResult = await fetchSSDPDiscovery();
            const wsUrl = `ws://${ssdpResult}:37521`;
            if (await testWebSocket(wsUrl)) return wsUrl;
        } catch {}

        // 3. 最后尝试网关API（动态替换localhost）
        const gatewayUrl = `http://${localIP}:37520/discover`;
        const gatewayResult = await fetchWithTimeout(gatewayUrl, 2000);
        if (gatewayResult.ok) {
            const { ips } = await gatewayResult.json();
            for (const ip of ips) {
                if (!isLocalIP(ip)) continue;
                const wsUrl = `ws://${ip}:37521`;
                if (await testWebSocket(wsUrl)) return wsUrl;
            }
        }

        throw new Error('所有发现方式均失败');
    } catch (err) {
        console.error("服务发现失败:", err);
        throw err;
    }
}

// 新增超时工具函数
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return await fetch(url, { signal: controller.signal });
}

async function fetchSSDPDiscovery(): Promise<string> {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://239.255.255.250:1900', {
        method: 'M-SEARCH',
        headers: {
            'HOST': '239.255.255.250:1900',
            'MAN': 'ssdp:discover',
            'MX': '1',
            'ST': 'uuid:ETS2LA-WS-1.0'
        },
        signal: controller.signal
    });

    const location = response.headers.get('LOCATION');
    if (!location) throw new Error('Invalid SSDP response');

    const gatewayResponse = await fetch(location);
    const { ws_url } = await gatewayResponse.json();
    return ws_url;
}

async function testWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        const timeout = 5000; // 超时时间延长至5秒

        const timer = setTimeout(() => {
            ws.close();
            resolve(false);
        }, timeout);

        ws.onopen = () => {
            clearTimeout(timer);
            ws.close();
            resolve(true);
        };

        ws.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
    });
}

