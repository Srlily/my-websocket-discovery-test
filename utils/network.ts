export const getLocalIPByBackend = async (): Promise<string | null> => {
    try {
        const res = await fetch("/api/local-ip");
        const data = await res.json();
        return data.ip;
    } catch (error) {
        console.error("获取本地IP失败:", error);
        return null;
    }
};
