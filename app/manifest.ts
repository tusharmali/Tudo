import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tudo",
    short_name: "Tudo",
    description: "Everything your team does, in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4fa",
    theme_color: "#7178dd",
    orientation: "portrait",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
