import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/openai": {
          target: "https://api.openai.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai/, "/v1"),
          secure: false,
          headers: {
            Authorization: `Bearer ${env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      },
    },
  };
});
