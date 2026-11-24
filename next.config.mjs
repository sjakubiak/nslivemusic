/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baked into the pages at build time (see src/components/Analytics.tsx). Public, not a secret.
  env: { CF_WEB_ANALYTICS_TOKEN: process.env.CF_WEB_ANALYTICS_TOKEN ?? "" },
};
export default nextConfig;
