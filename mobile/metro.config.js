// Metro de Expo, más la lógica compartida con la web (../src/lib), que la app
// importa como "@/lib/..." (alias en tsconfig.json).
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src/lib")];

module.exports = config;
