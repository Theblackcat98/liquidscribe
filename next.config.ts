import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode floating badge does not belong on a writing surface.
  devIndicators: false,
  // Allow opening the dev server from the LAN (phone testing).
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.180"],
};

export default nextConfig;
