export const discoverServices = async (): Promise<string[]> => {
    try {
        const bonjourIps = await fetch('/api/discover')
            .then(res => res.json())
            .then(data => data.ips);
        if (bonjourIps.length > 0) return bonjourIps;

        const gatewayResponse = await fetch('http://localhost:37520/discover');
        const { ips } = await gatewayResponse.json();
        return ips || [];
    } catch (e) {  // 方案三：添加错误日志
        console.error("发现服务失败:", e);
        return [];
    }
};
