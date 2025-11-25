/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress webpack warnings for onnxruntime-web critical dependency
    config.ignoreWarnings = (config.ignoreWarnings || []).concat([
      {
        module: /onnxruntime-web/,
        message: /Critical dependency/,
      },
      {
        message: /vad\.worklet/,
      },
      {
        module: /onnxruntime-node/,
        message: /Critical dependency/,
      },
    ])

    // Add rule to suppress onnxruntime-web warnings at compilation level
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

    // Exclude onnxruntime-node bindings from browser build (only used server-side)
    if (!isServer) {
      // Ignore .node files in browser bundle (Node.js native bindings)
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      })

      // Also need to handle the onnxruntime-node module entirely
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      }
    }

    return config
  },
}

module.exports = nextConfig
