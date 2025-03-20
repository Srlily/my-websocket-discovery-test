import type { NextApiRequest, NextApiResponse } from "next";

interface IPResponse {
    ip: string;
    isLocal: boolean;
}

export default function handler(req: NextApiRequest, res: NextApiResponse<IPResponse>) {
    let clientIp = req.socket.remoteAddress;

    if (clientIp?.startsWith("::ffff:")) {
        clientIp = clientIp.slice(7);
    }

    if (clientIp === '::1') {
        clientIp = '127.0.0.1';
    }

    if (!clientIp) {
        clientIp = "无法获取IP";
    }

    const isLocal = clientIp === '127.0.0.1' ||
        clientIp?.startsWith('192.168') ||
        clientIp?.startsWith('10.') ||
        clientIp?.startsWith('172.');

    res.status(200).json({ ip: clientIp, isLocal });
}
