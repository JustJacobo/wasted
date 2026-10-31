// Lint de la app nativa (npx expo lint). La web tiene el suyo en la raíz.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "android/*", "ios/*"] },
  // Los plugins de Expo y las configuraciones corren en Node (CommonJS).
  {
    files: ["plugins/**/*.js", "*.config.js"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly" } },
  },
]);
