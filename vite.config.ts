import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // O desenvolvimento continua em /; a build publicada vive no subdiretório
  // padrão do GitHub Pages deste repositório.
  base: command === "build" ? "/neve-brava/" : "./",
  build: { rollupOptions: { input: { main: "index.html", grabLab: "grab-lab.html" } } },
  server: { host: "127.0.0.1" },
}));
