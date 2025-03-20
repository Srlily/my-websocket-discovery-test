import type { NextApiRequest, NextApiResponse } from 'next';
import { Bonjour } from 'bonjour-service';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const instance = new Bonjour();
    const timeout = 10000; // 10秒超时
    const uniqueIPs = new Set<string>();
    let browser: ReturnType<typeof instance.find>;

    let resolved = false; // 标记是否已响应

    const cleanup = () => {
        browser?.stop();
        instance.destroy();
    };

    // 立即返回发现的IP（即使超时前）
    const respond = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        res.status(200).json({ ips: Array.from(uniqueIPs) });
    };

    // 设置超时
    const timer = setTimeout(() => {
        if (!resolved && uniqueIPs.size === 0) {
            respond(); // 超时后返回空结果
        }
    }, timeout);

    try {
        browser = instance.find({
            type: 'ETS2LA-WS',
        });

        browser.on('up', (service) => {
            console.log('[DEBUG] 发现服务:', {
                name: service.name,
                type: service.type,
                host: service.host,
                addresses: service.addresses,
            });

            const addresses = [
                ...(service.addresses || []),
                service.host,
                ...(service.referer?.address ? [service.referer.address] : []),
            ];

            addresses.forEach((addr) => {
                const cleanAddr = (addr as string).trim();
                if (cleanAddr) uniqueIPs.add(cleanAddr);
            });

            // 发现第一个IP后立即返回
            if (uniqueIPs.size > 0 && !resolved) {
                respond();
            }
        });

        browser.on('error', (err) => {
            console.error('[mDNS] 扫描错误:', err);
            cleanup();
            res.status(500).json({ error: '扫描过程中发生错误' });
        });

    } catch (err) {
        cleanup();
        res.status(500).json({ error: '服务初始化失败' });
    }
}
