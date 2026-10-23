import type { NextConfig } from "next";

// Cache Components queda apagado: casi todo en la app depende de la sesión del
// usuario, así que el modelo dinámico clásico es más simple y suficiente.
const nextConfig: NextConfig = {
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
