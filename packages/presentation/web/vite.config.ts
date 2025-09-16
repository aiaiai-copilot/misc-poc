import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }): UserConfig => {
  const isLibraryBuild =
    command === 'build' &&
    mode === 'production' &&
    process.env.BUILD_LIB === 'true';

  if (isLibraryBuild) {
    // Library build configuration
    return {
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'PresentationWeb',
          formats: ['es', 'cjs'],
          fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
          external: [
            'react',
            'react-dom',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            '@radix-ui/react-slot',
            '@radix-ui/react-label',
          ],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    };
  }

  // App development/build configuration
  const config: UserConfig = {
    plugins: [
      react(),
      // Add bundle analyzer for production builds
      ...(command === 'build' && mode === 'production'
        ? [
            visualizer({
              filename: 'dist/bundle-analysis.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      // Production build optimizations
      target: 'esnext',
      minify: 'terser',
      sourcemap: true, // Enable source maps for production debugging
      cssCodeSplit: true, // Enable CSS code splitting
      rollupOptions: {
        output: {
          // Asset hashing for CDN-ready builds
          assetFileNames: (assetInfo) => {
            const fileName =
              assetInfo.names?.[0] || assetInfo.originalFileName || 'asset';
            const info = fileName.split('.');
            let extType = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'img';
            } else if (/woff2?|eot|ttf|otf/i.test(extType)) {
              extType = 'fonts';
            }
            return `assets/${extType}/[name]-[hash][extname]`;
          },
          entryFileNames: 'assets/js/[name]-[hash].js',
          chunkFileNames: 'assets/js/[name]-[hash].js',
          // Manual chunk splitting for better caching
          manualChunks: {
            // React ecosystem
            'react-vendor': ['react', 'react-dom'],
            // UI libraries
            'ui-vendor': [
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
              'lucide-react',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
              'sonner',
            ],
            // Heavy dependencies (if any grow large)
            utils: ['react-window'],
          },
        },
      },
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.log in production
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 500, // Alert if chunks exceed 500KB
    },
  };

  return config;
});
