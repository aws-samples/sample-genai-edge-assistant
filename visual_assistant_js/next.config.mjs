/** @type {import('next').NextConfig} */
import path from 'path';
const __dirname = path.resolve()

const nextConfig = {
  reactStrictMode: false,
  output: 'export',
  // (Optional) Export as a static site
  // See https://nextjs.org/docs/pages/building-your-application/deploying/static-exports#configuration

  // Override the default webpack configuration
  serverExternalPackages: ["@huggingface/transformers"],

};

export default nextConfig;