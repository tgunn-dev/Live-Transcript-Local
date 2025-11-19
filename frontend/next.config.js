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
    ])

    // Add rule to suppress onnxruntime-web warnings at compilation level
    config.plugins = (config.plugins || []).concat([
      {
        apply: (compiler) => {
          compiler.hooks.compilation.tap('SuppressOnnxWarnings', (compilation) => {
            compilation.warnings = compilation.warnings.filter(
              (warning) => !warning.message?.includes('onnxruntime-web')
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

    return config
  },
}

module.exports = nextConfig
