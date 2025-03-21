// pages/index.tsx
"use client"
import { NextPage } from 'next';
import ConnectionManager from '../components/NetworkDiscovery';

const HomePage: NextPage = () => {
  return (
      <div>
        <h1>服务端自动发现示例</h1>
        <ConnectionManager />
        {/* 其他 UI 组件 */}
      </div>
  );
};

export default HomePage;