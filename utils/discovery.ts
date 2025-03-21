// utils/discovery.ts

// 调试模式配置
// const DEBUG = true;
const WS_PORT = 37521;
export const API_PORT = 37520;

// 判断是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

// 获取客户端本地 IP（安全版）
export const getClientLocalIPs = (): Promise<string[]> => {
    if (!isBrowser) return Promise.resolve([]);

    return new Promise((resolve) => {
        const ips: string[] = [];
        if (!('RTCPeerConnection' in window)) {
            resolve([]);
            return;
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        const timeout = setTimeout(() => {
            pc.close();
            resolve(ips);
        }, 5000);

        pc.createDataChannel('');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(() => clearTimeout(timeout));

        pc.onicecandidate = (e) => {
            if (!e.candidate) {
                clearTimeout(timeout);
                resolve(ips);
                return;
            }
            const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
            const match = e.candidate.candidate.match(ipRegex);
            if (match && !ips.includes(match[1])) {
                ips.push(match[1]);
            }
        };
    });
};

// 生成智能候选 IP 列表
const generateSmartIPs = (clientIP: string): string[] => {
    const base = clientIP.split('.').slice(0, 3).join('.');
    return [
        `${base}.1`, `${base}.100`, `${base}.254`,
        `${base}.2`, `${base}.101`, `${base}.50`, clientIP
    ];
};

// WebSocket 健康检查（类型安全版）
const checkWebSocket = (ip: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!isBrowser) {
            reject(new Error('WebSocket 仅在浏览器中可用'));
            return;
        }

        const ws = new WebSocket(`ws://${ip}:${WS_PORT}`);
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                ws.close();
                reject(new Error(`连接超时 (${ip})`));
            }
        }, 5000);

        ws.onopen = () => {
            resolved = true;
            clearTimeout(timeout);
            ws.send(JSON.stringify({
                text: "ping",
                type: "healthcheck"
            }));

            ws.onmessage = (e) => {
                try {
                    const response = JSON.parse(e.data);
                    if (response.text === "pong" || response.status === "received") {
                        ws.close();
                        resolve(ip);
                    } else {
                        reject(new Error(`无效响应: ${e.data}`));
                    }
                } catch {
                    reject(new Error('消息解析失败'));
                }
            };
        };

        ws.onerror = (event: Event) => {
            if (!resolved) {
                clearTimeout(timeout);
                reject(new Error(`连接错误: ${(event as ErrorEvent).message}`));
            }
        };

        ws.onclose = (event) => {
            if (!resolved) {
                reject(new Error(`连接关闭 (code ${event.code})`));
            }
        };
    });
};

// 主发现逻辑
export const discoverServer = async (): Promise<string> => {
    if (!isBrowser) throw new Error('发现功能仅在浏览器中可用');

    try {
        // 快速扫描
        const localIPs = await getClientLocalIPs();
        const candidates = localIPs.flatMap(ip => [
            ...generateSmartIPs(ip),
            ...Array.from({ length: 20 }, (_, i) =>
                `${ip.split('.')[0]}.${ip.split('.')[1]}.${ip.split('.')[2]}.${i + 50}`
            )
        ]);

        const BATCH_SIZE = 10;
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(ip => checkWebSocket(ip).catch(() => null))
            );
            const found = results.find(ip => ip !== null);
            if (found) return found;
        }

        // 全子网扫描
        const allIPs = localIPs.flatMap(ip =>
            Array.from({ length: 254 }, (_, i) =>
                `${ip.split('.')[0]}.${ip.split('.')[1]}.${ip.split('.')[2]}.${i + 1}`
            )
        );

        for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
            const batch = allIPs.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(ip => checkWebSocket(ip).catch(() => null))
            );
            const found = results.find(ip => ip !== null);
            if (found) return found;
        }

        throw new Error('无法发现服务端');
    } catch (error) {
        throw new Error(
            error instanceof Error ? error.message : '未知错误'
        );
    }
};

// API 发现方案
export const discoverViaAPI = async (baseIP: string): Promise<string> => {
    try {
        // 常见局域网 IP 地址段
        const commonIPs = [
            `${baseIP}.1`,
            `${baseIP}.100`,
            `${baseIP}.254`,
            `${baseIP}.50`,
            `${baseIP}.101`
        ];

        // 尝试所有常见 IP 地址
        for (const ip of commonIPs) {
            try {
                const apiUrl = `http://${ip}:${API_PORT}/backend/ip`;
                const response = await fetch(apiUrl, {
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                });

                const data = await response.json();

                if (Array.isArray(data.ips)) {
                    // 验证 IP 有效性
                    for (const serverIP of data.ips) {
                        try {
                            await checkWebSocket(serverIP);
                            return serverIP;
                        } catch {
                            continue;
                        }
                    }
                }
            } catch {
                continue;
            }
        }
        throw new Error('无法通过 API 发现服务端');
    } catch (error) {
        throw new Error(
            error instanceof Error ? error.message : 'API 发现失败'
        );
    }
};