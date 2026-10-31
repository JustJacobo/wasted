// Windows tiene un límite de 260 caracteres por ruta y el Ninja que trae el CMake
// por defecto de Android (3.22.1) no lo supera. CMake replica la ruta absoluta de
// cada fuente dentro de su carpeta de objetos (worklets, gesture-handler…), así que
// con una carpeta de proyecto larga ninja falla al crearla.
//
// Expo fija CMAKE_OBJECT_PATH_MAX=1024 (no acorta nada); con 240, CMake reemplaza
// por un hash la parte larga de cada ruta de objeto y todo queda bajo el límite.
// En Linux (GitHub Actions) no cambia el resultado.
const { withGradleProperties } = require("expo/config-plugins");

const KEY = "expo.android.cmakeObjectPathMax";

module.exports = function withCmakeShortPaths(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((item) => !(item.type === "property" && item.key === KEY));
    mod.modResults.push({ type: "property", key: KEY, value: "240" });
    return mod;
  });
};
