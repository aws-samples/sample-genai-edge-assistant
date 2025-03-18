import path from 'path';
const __dirname = path.resolve()

const nextConfig = {
    reactStrictMode: false,
    output: 'export',
    // (Optional) Export as a static site
    // See https://nextjs.org/docs/pages/building-your-application/deploying/static-exports#configuration

    // Override the default webpack configuration
    webpack(config, { isServer }) {
        config.resolve.alias['@huggingface/transformers'] = path.resolve(__dirname, 'node_modules/@huggingface/transformers');
        config.resolve.alias['@'] = path.resolve(__dirname, '/src');
        // See https://webpack.js.org/configuration/resolve/#resolvealias
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp$": false,
            "onnxruntime-node$": false,
        }
        return config;
    },
}

export default nextConfig;