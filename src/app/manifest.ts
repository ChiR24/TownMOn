import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Company A Township",
    short_name: "Township",
    description: "Pay maintenance, raise complaints, approve visitors and book the clubhouse.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f2ef",
    theme_color: "#f3f2ef",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
