// utils/discovery.ts
const WS_PORT = 37521;
export const API_PORT = 37520;

// 浏览器环境检测
export const isBrowser = typeof window !== "undefined";

// 安全获取本地IP
export const getClientLocalIPs = (): Promise<string[]> => {
    if (!isBrowser) return Promise.resolve([]);

    return new Promise((resolve) => {
        const ips: string[] = [];
        if (!("RTCPeerConnection" in window)) {
            console.warn("浏览器不支持WebRTC");
            return resolve([]);
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        const timeout = setTimeout(() => {
            pc.close();
            resolve(ips);
        }, 5000);

        pc.createDataChannel("");
        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
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

// WebSocket健康检查（客户端专用）
const checkWebSocket = (ip: string): Promise<string> => {
    if (!isBrowser) return Promise.reject("仅限浏览器环境");

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${ip}:${WS_PORT}`);
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                ws.close();
                reject(`连接超时 (${ip})`);
            }
        }, 5000);

        ws.onopen = () => {
            resolved = true;
            clearTimeout(timeout);
            ws.send(JSON.stringify({ text: "ping", type: "healthcheck" }));
        };

        ws.onmessage = (e) => {
            try {
                const response = JSON.parse(e.data);
                if (response.text === "pong" || response.status === "received") {
                    ws.close();
                    resolve(ip);
                } else {
                    reject("无效响应");
                }
            } catch {
                reject("消息解析失败");
            }
        };

        ws.onerror = (event: Event) => {
            if (!resolved) {
                reject(`连接错误: ${(event as ErrorEvent).message}`);
            }
        };
    });
};

// 智能IP生成器
const generateSmartIPs = (clientIP: string): string[] => {
    const base = clientIP.split(".").slice(0, 3).join(".");
    return [
        // 常见IP段
        `${base}.1`, `${base}.100`, `${base}.254`,
        `${base}.2`, `${base}.101`, `${base}.50`,
        // 移动热点
        "192.168.43.1", "192.168.49.1",
        // 虚拟网络
        "10.0.0.1", "172.20.10.1"
    ];
};

// 主发现逻辑（纯客户端）
export const discoverServer = async (): Promise<string> => {
    if (!isBrowser) throw new Error("发现功能仅限浏览器使用");

    try {
        const localIPs = await getClientLocalIPs();
        if (localIPs.length === 0) throw new Error("无法获取本地网络信息");

        const candidates = localIPs.flatMap(ip => [
            ...generateSmartIPs(ip),
            ...Array.from({ length: 20 }, (_, i) => `${ip.split('.')[0]}.${ip.split('.')[1]}.${ip.split('.')[2]}.${i + 50}`)
        ]);

        // 随机顺序扫描
        const shuffled = [...new Set(candidates)].sort(() => Math.random() - 0.5);

        // 分批次扫描
        const BATCH_SIZE = 15;
        for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
            const batch = shuffled.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(ip => checkWebSocket(ip).catch(() => null))
            );
            const found = results.find(ip => ip !== null);
            if (found) return found;
        }

        throw new Error("未发现可用服务端");
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "发现失败");
    }
};

// API发现方案
export const discoverViaAPI = async (baseIP: string): Promise<string> => {
    const commonIPs = [
        `${baseIP}.1`, `${baseIP}.100`, `${baseIP}.254`,
        `${baseIP}.50`, `${baseIP}.101`
    ];

    for (const ip of commonIPs) {
        try {
            const response = await fetch(`http://${ip}:${API_PORT}/backend/ip`, {
                mode: "cors",
                headers: { "Content-Type": "application/json" },
            });

            const { ips } = await response.json();
            if (!Array.isArray(ips)) continue;

            for (const serverIP of ips) {
                try {
                    await checkWebSocket(serverIP);
                    return serverIP;
                } catch {
                    continue;
                }
            }
        } catch {
            continue;
        }
    }
    throw new Error("API发现失败");
};