import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'


// https://vite.dev/config/


export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  base: './',
  plugins: [vue(),
  AutoImport({
    resolvers: [ElementPlusResolver()],
  }),
  Components({
    resolvers: [ElementPlusResolver()],
  }),
  ],
  build: {
    rollupOptions: {
      // https://rollupjs.org/configuration-options/
      output: {
        dir: './target',
        name: 'gps_amap_tracking',
        assetFileNames: () => {
          // 资源使用默认的hash命名
          return `assets/[name]-[hash].[ext]`
        },
      },

    },
    assetsDir: 'assets',
    //
    watch: {},
    // 设置 target，这里可以指定浏览器或 Node.js 的版本
    target: 'esnext',  // 目标可以是 'esnext', 'es2015', 'chrome58' 等
    // 开启压缩
    minify: 'esbuild',
    sourcemap: false,    // 开启 sourcemap，便于调试
  },
  // assetsInclude: ['**/*.png', '**/*.css', '**/*.svg'],
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    }
  },
});
