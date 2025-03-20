import type { NextApiRequest, NextApiResponse } from "next";

// 定义全局类型扩展
declare global {
    interface Global {
        activeServers?: Record<string, ServerRecord>;
    }
}

type ServerRecord = {
    last_seen: number;
    ip: string;
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
    // 使用类型断言代替any
    const activeServers = (global as Global).activeServers || {};

    const now = Date.now();

    const filtered = Object.entries(activeServers).reduce(
        (acc, [user_id, server]) => {
            // 类型收窄后不再需要断言
            if (now - server.last_seen < 10 * 60 * 1000) {
                acc.push({ user_id, ip: server.ip });
            }
            return acc;
        },
        [] as { user_id: string; ip: string }[]
    );

    res.status(200).json({ servers: filtered });
}