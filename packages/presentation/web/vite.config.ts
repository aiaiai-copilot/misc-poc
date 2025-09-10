import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }): UserConfig => {
  const isLibraryBuild = command === 'build' && mode === 'production' && process.env.BUILD_LIB === 'true';
  
  if (isLibraryBuild) {
    // Library build configuration
    return {
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
    };
  }

  // App development/build configuration
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
