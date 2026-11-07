import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Vite's pre-bundling breaks the ffmpeg.wasm worker in dev mode.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
