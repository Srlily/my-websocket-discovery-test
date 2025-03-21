// service-discovery.ts
export async function discoverWebSocketService(): Promise<string> {
    try {
        // 优先尝试网关API
        const gatewayResult = await fetchWithTimeout('http://localhost:37520/discover', 2000);
        if (gatewayResult.ok) {
            const { ws_url, ips } = await gatewayResult.json();
            if (ws_url) return testWebSocket(ws_url);
            else if (ips.length > 0) return testWebSocket(`ws://${ips[0]}:37521`);
        }
    } catch {}

    // 尝试Bonjour发现
    try {
        const bonjourResponse = await fetch('/api/discover'); // 调用前端的discover.ts
        const { ips } = await bonjourResponse.json();
        if (ips.length > 0) return testWebSocket(`ws://${ips[0]}:37521`);
    } catch {}

    // 最后使用SSDP回退
    try {
        const ssdpResult = await fetchSSDPDiscovery();
        return testWebSocket(ssdpResult);
    } catch {}

    throw new Error('所有发现方式均失败');
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

async function testWebSocket(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
            ws.close();
            resolve(url);
        };
        ws.onerror = () => reject();
        // 添加 void 操作符忽略 setTimeout 的返回值
        void setTimeout(reject, 1000);
    });
}

// 使用示例
discoverWebSocketService()
    .then(url => console.log('发现服务地址:', url))
    .catch(() => console.warn('未找到可用服务'));