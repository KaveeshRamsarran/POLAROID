export default {
  optimizeDeps: { noDiscovery: true, include: [] },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
  server: { host: "127.0.0.1", port: 3000, strictPort: true },
};
