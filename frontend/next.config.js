/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress webpack warnings for onnxruntime critical dependency
    config.ignoreWarnings = (config.ignoreWarnings || []).concat([
      {
        module: /onnxruntime-web/,
        message: /Critical dependency/,
      },
      {
        module: /onnxruntime-node/,
        message: /Critical dependency/,
      },
      {
        message: /vad\.worklet/,
      },
    ])

    // Add rule to suppress onnxruntime warnings at compilation level
    config.plugins = (config.plugins || []).concat([
      {
        apply: (compiler) => {
          compiler.hooks.compilation.tap('SuppressOnnxWarnings', (compilation) => {
            compilation.warnings = compilation.warnings.filter(
              (warning) => !warning.message?.includes('onnxruntime-web') && !warning.message?.includes('onnxruntime-node')
            )
          })
        },
      },
    ])

    // Handle VAD worklet file
    config.module.rules.push({
      test: /vad\.worklet\.js$/,
      type: 'webassembly/async',
    })

    // Exclude onnxruntime-node and native bindings from browser build
    if (!isServer) {
      // Ignore .node files (Node.js native bindings - not needed in browser)
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      })

      // Fallback for onnxruntime-node module (use browser version instead)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
      }
    }

    // Alias transformers.js to use WASM backend for browser
    config.resolve.alias = {
      ...config.resolve.alias,
      '@xenova/transformers': '@xenova/transformers/dist/transformers.js',
    }

    return config
  },
}

module.exports = nextConfig
