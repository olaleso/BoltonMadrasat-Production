import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),

    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],

  // cloudflare:workers is a Workers runtime module, not an npm package.
  // Prevent Vite's dependency optimizer from trying to resolve it.
  optimizeDeps: {
    exclude: ["cloudflare:workers"],
  },

  environments: {
    rsc: {
      optimizeDeps: {
        exclude: ["cloudflare:workers"],
      },
    },

    ssr: {
      optimizeDeps: {
        exclude: ["cloudflare:workers"],
      },
    },
  },

  // Vite 8 uses Rolldown for production builds.
  // Leave this runtime import untouched for Cloudflare Workers.
  build: {
    rolldownOptions: {
      external: ["cloudflare:workers"],
    },
  },
});