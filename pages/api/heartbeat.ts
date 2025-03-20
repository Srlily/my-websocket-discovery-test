// pages/api/heartbeat.ts
import type { NextApiRequest, NextApiResponse } from "next";

interface HeartbeatRequest {
    user_id: string;
    ips: string[]; // 接收IP列表
}

interface ServerRecord {
    ips: string[];
    last_seen: number;
    public_ip: string | null; // 存储公网IP
}

const activeServers: Record<string, ServerRecord> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { user_id, ips } = req.body as HeartbeatRequest;

    // 验证IP列表
    const validIps = ips.filter(ip => isValidIP(ip));
    const publicIp = validIps.find(ip => !isLocalIP(ip)); // 提取公网IP

    // 更新记录
    activeServers[user_id] = {
        ips: validIps,
        public_ip: publicIp || null,
        last_seen: Date.now(),
    };

    res.status(200).json({ success: true });
}

// 辅助函数
const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);

const isLocalIP = (ip: string) => {
    return ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.');
};
