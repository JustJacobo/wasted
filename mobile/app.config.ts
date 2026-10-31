import type { ExpoConfig } from "expo/config";

// Versión desde el tag del workflow (android-v2.0.0 → "2.0.0"). Las de prueba
// (2.0.0-beta.3) quedan por debajo de la final: 19903 < 20000.
const version = process.env.WASTED_VERSION ?? "2.0.0";
const [major, minor, patch] = version.split("-")[0].split(".").map(Number);
const beta = /-beta\.(\d+)$/.exec(version)?.[1];
const versionCode = beta ? major * 10000 + minor * 100 + patch - 100 + Number(beta) : major * 10000 + minor * 100 + patch;

const config: ExpoConfig = {
  name: "Wasted",
  slug: "wasted",
  version,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // wasted://auth/callback (login), wasted://conectar y wasted://notificaciones.
  scheme: "wasted",
  userInterfaceStyle: "automatic",
  backgroundColor: "#f6f5f1",
  android: {
    // El mismo paquete y la misma firma que la app anterior: se instala encima.
    package: "app.wasted.android",
    versionCode,
    adaptiveIcon: {
      backgroundColor: "#161513",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f6f5f1",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
        dark: { backgroundColor: "#0f0e0d", image: "./assets/images/splash-icon.png" },
      },
    ],
    "expo-sharing",
    "./plugins/with-cmake-short-paths",
    "./plugins/with-app-shortcuts",
    "./plugins/with-release-signing",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
