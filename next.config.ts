import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prototype 100 % navigateur : les données vivent dans le store local, le
  // serveur ne rend qu'un squelette. Cache Components n'apporte rien ici.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
