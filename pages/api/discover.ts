import type { NextApiRequest, NextApiResponse } from 'next';
import { Bonjour } from 'bonjour-service';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const instance = new Bonjour();
    const timeout = 10000;
    const uniqueIPs = new Set<string>();
    let browser: ReturnType<typeof instance.find>; // 显式声明类型

    const cleanup = () => {
        browser?.stop();  // 安全调用
        instance.destroy();
        clearTimeout(timer);
    };

    const timer = setTimeout(() => {
        console.log(`[mDNS] 扫描完成，共发现 ${uniqueIPs.size} 个唯一IP`);
        cleanup();
        res.status(200).json({ ips: Array.from(uniqueIPs) });
    }, timeout);

    try {
        browser = instance.find({
            type: 'ETS2LA-WS'
        });

        browser.on('up', (service) => {
            console.log('[DEBUG] 发现服务:', {
                name: service.name,
                type: service.type,
                host: service.host,
                addresses: service.addresses
            });
            const addresses = [
                ...(service.addresses || []),
                service.host,
                ...(service.referer?.address ? [service.referer.address] : [])
            ];

            addresses.forEach(addr => {
                if (typeof addr === 'string') {
                    const cleanAddr = addr.trim();
                    if (cleanAddr) uniqueIPs.add(cleanAddr);
                }
            });
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
