export default defineNuxtConfig({
  compatibilityDate: "2026-10-13",
  devtools: { enabled: false },
  css: [
    "@fontsource/nunito/400.css",
    "@fontsource/nunito/600.css",
    "@fontsource/nunito/700.css",
    "@fontsource/nunito/800.css",
    "~/assets/css/main.css",
  ],
  runtimeConfig: {
    appwriteEndpoint: "",
    appwriteProjectId: "",
    appwriteApiKey: "",
    appwriteDatabaseId: "amaya",
    appwriteTableId: "purchases",
  },
  app: {
    head: {
      htmlAttrs: { lang: "ru" },
      title: "Amaya — Мир маленьких открытий",
      meta: [
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
      ],
    },
  },
});
