import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: `http://localhost:8002`,
        changeOrigin: true,
      },
    },
  },
  build: {
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 压缩选项
    minify: 'esbuild',
    // 目标浏览器
    target: 'es2020',
    // 源码映射（生产环境关闭以减小体积）
    sourcemap: false,
    rollupOptions: {
      output: {
        // 优化的代码分割策略
        manualChunks: (id) => {
          // React核心
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          // 路由
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          // UI组件库
          if (id.includes('node_modules/@radix-ui/') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge')) {
            return 'ui-vendor';
          }
          // 图表库单独分包
          if (id.includes('node_modules/echarts') ||
              id.includes('node_modules/zrender')) {
            return 'charts-vendor';
          }
          // 动画库
          if (id.includes('node_modules/framer-motion')) {
            return 'animation-vendor';
          }
          // 图标库
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          // SDK
          if (id.includes('node_modules/@metagptx/')) {
            return 'sdk-vendor';
          }
          // 工具库
          if (id.includes('node_modules/date-fns') ||
              id.includes('node_modules/lodash') ||
              id.includes('node_modules/axios')) {
            return 'utils-vendor';
          }
        },
      },
    },
    // 块大小警告阈值
    chunkSizeWarningLimit: 600,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
    ],
    // 排除大型库，让它们按需加载
    exclude: ['echarts'],
  },
});