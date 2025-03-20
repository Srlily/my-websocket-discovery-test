export const getLocalIPByBackend = async (): Promise<string | null> => {
    try {
        const res = await fetch("/api/local-ip");
        const data: { ip: string; isLocal: boolean } = await res.json();
        return data.ip;
    } catch (error) {
        console.error("获取本地IP失败:", error);
        return null;
    }
};

export const discoverServices = async (): Promise<string[]> => {
    try {
        const res = await fetch("/api/discover");
        const data = await res.json();
        return data.ips || [];
    } catch (error) {
        console.error("服务发现失败:", error);
        return [];
    }
};
export const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);