import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig((): UserConfig => ({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "PresentationWeb",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [
        "react", 
        "react-dom", 
        "lucide-react",
        "class-variance-authority",
        "clsx",
        "tailwind-merge",
        "@radix-ui/react-slot",
        "@radix-ui/react-label"
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
