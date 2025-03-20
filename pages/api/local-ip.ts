import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
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

    res.status(200).json({ ip: clientIp });
}
