// utils/network.ts
// export const isValidIP = (ip: string) => {
//     return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
// };

export const discoverServices = async (): Promise<string[]> => {
    const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || '127.0.0.1';
    return [SERVER_IP]; // 直接返回环境变量中的服务端IP
};
