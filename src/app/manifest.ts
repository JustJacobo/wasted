import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wasted",
    short_name: "Wasted",
    description: "Tus gastos e ingresos en segundos.",
    lang: "es-CO",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nuevo gasto",
        short_name: "Gasto",
        url: "/?nuevo=1",
        icons: [{ src: "/icons/192", sizes: "192x192" }],
      },
    ],
  };
}
