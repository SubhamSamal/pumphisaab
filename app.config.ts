import type { ExpoConfig } from "expo/config";

// One file for every kind of app (D43, D87):
//   development: our dev app that loads code from the Mac (com.pumphisaab.app)
//   preview:     the installable test app, beside the dev app (com.pumphisaab.app.preview)
//   production:  the pilot app (com.pumphisaab.app, permanent, D34)
// EAS sets APP_VARIANT from eas.json.
const variant = process.env.APP_VARIANT ?? "development";
const isPreview = variant === "preview";

const config: ExpoConfig = {
  name: isPreview ? "PumpHisaab Preview" : "PumpHisaab",
  slug: "pumphisaab",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPreview ? "pumphisaab-preview" : "pumphisaab",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: isPreview ? "com.pumphisaab.app.preview" : "com.pumphisaab.app",
  },
  android: {
    // Icon made from the drop logo (D88, scripts/make-icons.py).
    adaptiveIcon: {
      backgroundColor: "#0F766E",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: isPreview ? "com.pumphisaab.app.preview" : "com.pumphisaab.app",
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
        dark: { backgroundColor: "#0B1220", image: "./assets/images/splash-icon.png" },
      },
    ],
    "expo-font",
    // Crash reports (D52, D89). Readable reports: source maps go up with each build using the
    // SENTRY_AUTH_TOKEN secret the owner stored in Expo (never in this repo).
    ["@sentry/react-native/expo", { organization: "pumphisaab", project: "react-native" }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: { projectId: "a7bd83b0-f5ee-4e8d-9437-ac1bd75f0c91" },
    variant,
  },
  owner: "pumphisaab",
  runtimeVersion: { policy: "appVersion" },
  updates: { url: "https://u.expo.dev/a7bd83b0-f5ee-4e8d-9437-ac1bd75f0c91" },
};

export default config;
