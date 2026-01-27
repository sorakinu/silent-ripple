import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  
  plugins: [react()],
  base: '/silent-ripple/',
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
