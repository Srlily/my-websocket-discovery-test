// pages/api/local-ip.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    let clientIp = req.socket.remoteAddress;

    // 处理IPv4-mapped IPv6地址（如::ffff:192.168.1.1）
    if (clientIp?.startsWith("::ffff:")) {
        clientIp = clientIp.slice(7); // 去除前缀::ffff
    }

    // 过滤无效地址
    if (!clientIp || clientIp.startsWith("127.")) {
        clientIp = "无法获取IP";
    }

    res.status(200).json({ ip: clientIp });
}
