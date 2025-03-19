import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    res.status(200).json({ message: 'WebSocket API接口' });
    // 实际应集成WebSocket服务器逻辑（需使用专用库如 ws）
}
