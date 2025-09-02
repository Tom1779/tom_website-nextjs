/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config: any, { isServer }: any) => {
    // Handle client-side builds
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    // Ignore node modules that cause issues
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({
        canvas: "canvas",
      });
    }

    // Handle .node files and other binary files
    config.module = config.module || { rules: [] };
    config.module.rules.push({
      test: /\.node$/,
      use: "raw-loader",
    });

    // Ignore warnings from pdfjs-dist
    config.ignoreWarnings = [{ module: /node_modules\/pdfjs-dist/ }];

    return config;
  },

  // Transpile problematic packages
  transpilePackages: ["pdfjs-dist"],
  // Enable compression
  compress: true,
};

module.exports = nextConfig;
