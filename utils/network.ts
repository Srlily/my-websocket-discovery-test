export const discoverServices = async (): Promise<string[]> => {
    try {
        // 过滤非IPv4地址
        const validateIP = (ip: string): boolean => {
            const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
            return ipv4Regex.test(ip) && ip.split('.').every(num => num <= 255);
        };

        // Bonjour发现
        const bonjourIps = await fetch('/api/discover')
            .then(res => res.json())
            .then(data => data.ips.filter(validateIP));
        if (bonjourIps.length > 0) return bonjourIps;

        // 网关API
        const gatewayResponse = await fetch('http://localhost:37520/discover');
        const { ips } = await gatewayResponse.json();
        return ips.filter(validateIP) || [];
    } catch (e) {
        console.error("发现服务失败:", e);
        return [];
    }
};