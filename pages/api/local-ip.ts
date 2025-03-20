import type { NextApiRequest, NextApiResponse } from "next";

// 修改 pages/api/local-ip.ts
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    let clientIp = req.socket.remoteAddress;

    // 处理 IPv4-mapped IPv6 地址 (::ffff:127.0.0.1 → 127.0.0.1)
    if (clientIp?.startsWith("::ffff:")) {
        clientIp = clientIp.slice(7);
    }

    // 处理 IPv6 本地回环地址 (::1 → 127.0.0.1)
    if (clientIp === '::1') {
        clientIp = '127.0.0.1';
    }

    // 仅过滤无效地址（如 null 或空）
    if (!clientIp) {
        clientIp = "无法获取IP";
    }

    res.status(200).json({ ip: clientIp });
}

