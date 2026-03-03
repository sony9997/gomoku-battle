import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // 将 outputFileTracingRoot 设为项目根目录
  // 这样 standalone 镜像路径只包含相对于项目根的部分，不会镜像整个系统路径
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
