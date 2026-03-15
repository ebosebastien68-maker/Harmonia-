export default {
  expo: {
    name: "Harmonia",
    slug: "Harmonia",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",

    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#F5F5F5"
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.harmonia.app"
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F5F5F5"
      },
      package: "com.harmonia.app"
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",

      // PWA
      name: "Harmonia",
      shortName: "Harmonia",
      display: "standalone",
      themeColor: "#F5F5F5",
      backgroundColor: "#F5F5F5"
    },

    plugins: [
      "expo-router"
    ]
  }
};
