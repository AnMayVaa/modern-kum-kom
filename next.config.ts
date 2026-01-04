import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'lh3.googleusercontent.com', // 💡 อนุญาตโดเมนรูปของ Google
        },
      ],
    },
  };

export default nextConfig;
