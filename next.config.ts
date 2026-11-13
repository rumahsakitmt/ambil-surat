import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In development, let phones on the local network (and 127.0.0.1) load the app's scripts.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
