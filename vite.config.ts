import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,

    // ⭐ NEW: Copy staticwebapp.config.json into dist/
    viteStaticCopy({
      targets: [
        {
          src: 'staticwebapp.config.json',
          dest: '.'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});