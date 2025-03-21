// utils/discovery.ts

// 调试模式配置
const DEBUG = true;
const WS_PORT = 37521; // 根据 notifications.py 配置
export const API_PORT = 37520; // 根据 webserver.py 配置

// 获取客户端本地 IP（兼容移动端浏览器）
const getClientLocalIPs = (): Promise<string[]> => {
    return new Promise((resolve) => {
        const ips: string[] = [];
        const pc = new RTCPeerConnection({ iceServers: [] });

        // 移动端超时处理（iOS 需要更长时间）
        const timeout = setTimeout(() => {
            pc.close();
            DEBUG && console.log('[Discovery] WebRTC 超时，使用备用方案');
            resolve(ips);
        }, 5000);

        pc.createDataChannel('');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(() => clearTimeout(timeout));

        pc.onicecandidate = (e) => {
            if (!e.candidate) {
                clearTimeout(timeout);
                DEBUG && console.log('[Discovery] 发现本地 IP:', ips);
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

    // 常见路由器和设备 IP 模式
    return [
        `${base}.1`,    // 路由器
        `${base}.100`,  // 常见 DHCP 起始
        `${base}.254`,  // 网关
        `${base}.2`,    // 二级路由
        `${base}.101`,  // 常见 DHCP 分配
        `${base}.50`,   // 手机热点常见
        clientIP       // 自身 IP（开发环境）
    ];
};

// WebSocket 健康检查（移动端优化）
// WebSocket 健康检查（修正消息格式）
const checkWebSocket = (ip: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${ip}:${WS_PORT}`);
        let resolved = false;

        // 消息格式修正
        const validMessage = JSON.stringify({
            text: "ping", // 匹配服务端期待的 text 字段
            type: "healthcheck" // 可选辅助字段
        });

        const timeout = setTimeout(() => {
            if (!resolved) {
                ws.close();
                DEBUG && console.log(`[Discovery] ${ip} 超时`);
                reject(new Error(`连接超时 (${ip})`));
            }
        }, 5000);

        ws.onopen = () => {
            DEBUG && console.log(`[Discovery] ${ip} 连接成功`);
            resolved = true;
            clearTimeout(timeout);

            // 发送符合服务端要求的消息格式
            ws.send(validMessage);

            ws.onmessage = (e) => {
                try {
                    const response = JSON.parse(e.data);
                    // 同时兼容 text 和 status 字段的验证
                    if (response.text === "pong" || response.status === "received") {
                        ws.close();
                        resolve(ip);
                    } else {
                        reject(new Error(`无效响应: ${e.data}`));
                    }
                } catch{
                    reject(new Error(`消息解析失败: ${e.data}`));
                }
            };
        };

        ws.onerror = (error) => {
            if (!resolved) {
                clearTimeout(timeout);
                reject(new Error(`连接错误: ${(error as ErrorEvent).message}`));
            }
        };

        // 添加关闭事件处理
        ws.onclose = (event) => {
            if (!resolved) {
                reject(new Error(`连接关闭 (code ${event.code})`));
            }
        };
    });
};

// 主发现逻辑
export const discoverServer = async (): Promise<string> => {
    DEBUG && console.log('[Discovery] 启动服务端发现流程');

    // 阶段 1：快速扫描（常见 IP + 本地接口）
    const fastScan = async (): Promise<string | null> => {
        try {
            // 获取客户端可能的子网信息
            const localIPs = await getClientLocalIPs();
            if (localIPs.length === 0) return null;

            // 生成候选 IP 列表
            const candidates = localIPs.flatMap(ip => [
                ...generateSmartIPs(ip),
                ...Array.from({ length: 20 }, (_, i) => `${ip.split('.')[0]}.${ip.split('.')[1]}.${ip.split('.')[2]}.${i + 50}`)
            ]);

            // 去重并随机排序
            const uniqueIPs = [...new Set(candidates)];
            const shuffledIPs = uniqueIPs.sort(() => Math.random() - 0.5);

            // 并行探测（每批 10 个 IP）
            const BATCH_SIZE = 10;
            for (let i = 0; i < shuffledIPs.length; i += BATCH_SIZE) {
                const batch = shuffledIPs.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(
                    batch.map(ip => checkWebSocket(ip).catch(() => null))
                );
                const found = results.find(ip => ip !== null);
                if (found) return found;
            }
        } catch (error) {
            DEBUG && console.error('[Discovery] 快速扫描失败:', error);
        }
        return null;
    };

    // 阶段 2：全子网扫描
    const fullScan = async (): Promise<string | null> => {
        const localIPs = await getClientLocalIPs();
        const allIPs = localIPs.flatMap(ip =>
            Array.from({ length: 254 }, (_, i) =>
                `${ip.split('.')[0]}.${ip.split('.')[1]}.${ip.split('.')[2]}.${i + 1}`
            )
        );

        // 分批次扫描（每批 15 个 IP）
        const BATCH_SIZE = 15;
        for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
            const batch = allIPs.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(ip => checkWebSocket(ip).catch(() => null))
            );
            const found = results.find(ip => ip !== null);
            if (found) return found;
        }
        return null;
    };

    // 执行扫描流程
    return await fastScan() || await fullScan() || (() => {
        throw new Error('无法发现服务端');
    })();
};

// 备用 API 发现方案
export const discoverViaAPI = async (): Promise<string> => {
    try {
        // 动态构建 API 地址
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const apiUrl = `${protocol}//${hostname}:${API_PORT}/backend/ip`;

        const response = await fetch(apiUrl, {
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();

        // 验证获取到的 IP
        const failedIPs: string[] = [];
        for (const ip of data.ips) {
            try {
                await checkWebSocket(ip);
                return ip;
            } catch {
                failedIPs.push(ip);
            }
        }

        // 增强错误信息
        throw new Error([
            'API 返回的 IP 均无法连接',
            `尝试列表: ${data.ips.join(', ')}`,
            `失败详情: ${failedIPs.join(', ')} 连接失败`
        ].join('\n'));

    } catch (error) {
        DEBUG && console.error('[Discovery] API 发现失败:', error);
        throw error; // 这里会抛给上层调用者处理
    }
};