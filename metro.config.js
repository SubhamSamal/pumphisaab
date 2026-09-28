// Sentry's version of Expo's Metro config: adds the ids that let crash reports point at our
// readable code (D89). NativeWind on top, as before.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
