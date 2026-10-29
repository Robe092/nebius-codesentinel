/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Keep verification builds separate from the running local preview.
  distDir: process.env.CODE_SENTINEL_BUILD_DIR || ".next",
  // Allow running server actions or API endpoints smoothly
};

export default nextConfig;
