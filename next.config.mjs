/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  transpilePackages: [
    "antd",
    "@ant-design/icons",
    "rc-util",
    "rc-pagination",
    "rc-picker",
    "rc-tree",
    "rc-table",
  ],
  experimental: {
    serverComponentsExternalPackages: ["xlsx"],
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
