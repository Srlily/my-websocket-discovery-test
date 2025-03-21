// // discover.ts
// import type { NextApiRequest, NextApiResponse } from 'next';
// import { Bonjour } from 'bonjour-service';
//
// export default function handler(_req: NextApiRequest, res: NextApiResponse) {
//     const instance = new Bonjour();
//     const timeout = 10000;
//     const uniqueIPs = new Set<string>();
//     let browser: ReturnType<InstanceType<typeof Bonjour>['find']> | undefined;
//     let resolved = false;
//
//     const cleanup = () => {
//         browser?.stop();
//         instance.destroy();
//     };
//
//     const respond = () => {
//         if (resolved) return;
//         resolved = true;
//         clearTimeout(timer);
//         cleanup();
//         res.status(200).json({ ips: Array.from(uniqueIPs) });
//     };
//
//     const timer = setTimeout(() => {
//         if (!resolved && uniqueIPs.size === 0) respond();
//     }, timeout);
//
//     try {
//         browser = instance.find({ type: 'ETS2LA-WS' }); // 正确调用实例方法
//
//         browser.on('up', (service) => {
//             const addresses = [
//                 ...(service.addresses || []),
//                 service.host,
//                 service.referer?.address,
//             ];
//
//             addresses.forEach((addr) => {
//                 const cleanAddr = (addr as string).trim();
//                 if (cleanAddr) uniqueIPs.add(cleanAddr);
//             });
//
//             if (uniqueIPs.size > 0 && !resolved) respond();
//         });
//
//         browser.on('error', (err) => {
//             console.error(err);
//             cleanup();
//             res.status(500).json({ error: '扫描失败' });
//         });
//     } catch (err) {
//         console.error(err);
//         cleanup();
//         res.status(500).json({ error: '服务初始化失败' });
//     }
// }

// pages/api/discover.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Bonjour } from 'bonjour-service';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
    const instance = new Bonjour();
    const timeout = 10000;
    const uniqueIPs = new Set<string>();
    let browser: ReturnType<InstanceType<typeof Bonjour>['find']> | undefined;
    let resolved = false;

    const cleanup = () => {
        browser?.stop();
        instance.destroy();
    };

    const respond = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        cleanup();
        res.status(200).json({ ips: Array.from(uniqueIPs) });
    };

    const timer = setTimeout(() => {
        if (!resolved && uniqueIPs.size === 0) respond();
    }, timeout);

    try {
        browser = instance.find({ type: 'ETS2LA-WS' });

        browser.on('up', (service) => {
            const addresses = [
                ...(service.addresses || []),
                service.host,
                service.referer?.address,
            ];

            addresses.forEach((addr) => {
                const cleanAddr = (addr as string).trim();
                if (cleanAddr) uniqueIPs.add(cleanAddr);
            });

            if (uniqueIPs.size > 0 && !resolved) respond();
        });

        browser.on('error', (err) => {
            console.error(err);
            cleanup();
            res.status(500).json({ error: '扫描失败' });
        });
    } catch (err) {
        console.error(err);
        cleanup();
        res.status(500).json({ error: '服务初始化失败' });
    }
}
