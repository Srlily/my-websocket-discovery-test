
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const ips = await fetch('http://localhost:37520/backend/ip')
            .then(response => response.json())
            .then(data => data.ips || []);

        res.status(200).json({ ips });
    } catch (err) {
        const errorMessage = (err as Error).message || '未知错误';
        console.error(err);
        res.status(500).json({ error: `无法获取服务器地址: ${errorMessage}` });
    }
}
