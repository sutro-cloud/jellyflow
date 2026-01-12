import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function adsTxtPlugin(content) {
  return {
    name: "ads-txt",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];

        if (url !== "/ads.txt") {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(content);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "ads.txt",
        source: content,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const adsTxtRaw = env.VITE_ADS_TXT || "";
  const adsTxtValue = adsTxtRaw.replace(/\\n/g, "\n").trim();
  const adsTxtContent = adsTxtValue ? `${adsTxtValue}\n` : "";

  const plugins = [react()];

  if (adsTxtContent) {
    plugins.push(adsTxtPlugin(adsTxtContent));
  }

  return {
    plugins,
    server: {
      port: 8067,
      strictPort: true,
    },
    preview: {
      port: 8067,
      strictPort: true,
    },
  };
});
