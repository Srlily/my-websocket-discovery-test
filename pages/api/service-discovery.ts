import { discoverServices } from "@/utils/network";

// 新增IPv6验证
const validateIP = (ip: string): boolean => {
    const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){6}(:[0-9a-fA-F]{1,4}){0,2}|([0-9a-fA-F]{1,4}:){5}(:[0-9a-fA-F]{1,4}){0,3}|([0-9a-fA-F]{1,4}:){4}(:[0-9a-fA-F]{1,4}){0,4}|([0-9a-fA-F]{1,4}:){3}(:[0-9a-fA-F]{1,4}){0,5}|([0-9a-fA-F]{1,4}:){2}(:[0-9a-fA-F]{1,4}){0,6}|[0-9a-fA-F]{1,4}:(:[0-9a-fA-F]{1,4}){0,7}|:(:[0-9a-fA-F]{1,4}){0,8}|fe80::[0-9a-fA-F]{0,4}%[0-9a-zA-Z]{1,})$/i;
    return (
        (ipv4Regex.test(ip) &&
            ip.split('.').every(numStr => {
                const num = parseInt(numStr, 10);
                return num >= 0 && num <= 255;
            })) ||
        ipv6Regex.test(ip)
    );
};

const isLocalIP = (ip: string): boolean => {
    return (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.') ||
        ip.startsWith('fe80::') ||
        ip.startsWith('::1')
    );
};

export async function discoverWebSocketService(): Promise<string> {
    try {
        const localIPResponse = await fetch('/api/local-ip');
        const localIPData = await localIPResponse.json();
        const localIP = localIPData.ip || 'localhost';

        // 1. 尝试Bonjour发现
        const bonjourIps = await discoverServices();
        for (const ip of bonjourIps) {
            try {
                const wsUrl = `ws://${ip}:37521`;
                console.log(`Testing IP: ${ip}`);
                if (await testWebSocket(wsUrl)) return wsUrl;
            } catch (e) {
                console.error(`IP ${ip} 连接失败: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        // 2. 尝试SSDP
        try {
            const ssdpResult = await fetchSSDPDiscovery();
            const wsUrl = `ws://${ssdpResult}:37521`;
            if (await testWebSocket(wsUrl)) return wsUrl;
        } catch (e) {
            console.error("SSDP发现失败:", e);
        }

        // 3. 最后尝试网关API
        const gatewayUrl = `http://${localIP}:37520/discover`;
        const gatewayResult = await fetchWithTimeout(gatewayUrl, 2000);
        if (gatewayResult.ok) {
            const { ips } = await gatewayResult.json();
            const validLocalIps = ips
                .filter(validateIP)
                .filter(isLocalIP);

            for (const ip of validLocalIps) {
                const wsUrl = `ws://${ip}:37521`;
                if (await testWebSocket(wsUrl)) return wsUrl;
            }
        }

        throw new Error('所有发现方式均失败，未找到可用服务');
    } catch (err) {
        const errorMessage = `服务发现失败：${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
}

// 新增超时工具函数
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal });
}

async function fetchSSDPDiscovery(): Promise<string> {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch('http://239.255.255.250:1900', {
            method: 'M-SEARCH',
            headers: {
                'HOST': '239.255.255.250:1900',
                'MAN': '"ssdp:discover"',
                'MX': '1',
                'ST': 'uuid:ETS2LA-WS-1.0'
            },
            signal: controller.signal
        });

        const location = response.headers.get('LOCATION');
        if (!location) throw new Error('SSDP响应缺少LOCATION字段');

        const gatewayResponse = await fetch(location);
        const { ws_url } = await gatewayResponse.json();
        return ws_url;
    } catch (e) {
        throw new Error(`SSDP请求失败: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function testWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timeout = 5000;

        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`WebSocket连接超时: ${url}`));
        }, timeout);

        ws.onopen = () => {
            clearTimeout(timer);
            ws.close();
            resolve(true);
        };

        ws.onerror = (error) => {
            clearTimeout(timer);
            reject(error);
        };
    });
}
