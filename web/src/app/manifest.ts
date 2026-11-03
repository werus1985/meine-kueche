import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meine Küche – Kücheninventar",
    short_name: "Meine Küche",
    description:
      "Küchenvorräte, Einkaufsliste und Haushaltsverwaltung – gemeinsam für die ganze Familie.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#047857",
    lang: "de",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
