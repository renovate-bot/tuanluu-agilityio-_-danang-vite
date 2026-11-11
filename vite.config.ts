import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối: dist/ chạy được ở thư mục con (GitHub Pages) lẫn tên miền gốc
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Three.js tách riêng: đổi code cầu không làm trình duyệt tải lại thư viện.
        // Trừ GLTFLoader / SkeletonUtils: chỉ nạp bằng import() động khi có người đi dạo (explore/stroll/rig.ts), để Rollup tách chunk riêng, trang thường không tải
        manualChunks: (id) => (id.includes('node_modules/three') && !/GLTFLoader|SkeletonUtils/.test(id) ? 'three' : undefined)
      }
    }
  }
});
