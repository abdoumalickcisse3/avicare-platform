import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server (.next/standalone/server.js) for a
  // small production Docker image. See web/Dockerfile and infra/DEPLOY.md.
  output: "standalone",
};

export default nextConfig;
