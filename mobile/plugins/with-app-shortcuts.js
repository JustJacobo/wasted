// Accesos al mantener pulsado el ícono (registrar rápido, pagos automáticos, gasto,
// ingreso). La lista está en plugins/shortcuts.xml: se copia a res/xml de la app,
// donde existe el ícono @mipmap/ic_launcher (en el módulo no compila el release),
// y se enlaza desde la actividad principal, que es la que lee el launcher.
const fs = require("node:fs");
const path = require("node:path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

module.exports = function withAppShortcuts(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(__dirname, "shortcuts.xml"), path.join(dir, "shortcuts.xml"));
      return mod;
    },
  ]);
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity["meta-data"] = (activity["meta-data"] ?? []).filter((m) => m.$["android:name"] !== "android.app.shortcuts");
    activity["meta-data"].push({ $: { "android:name": "android.app.shortcuts", "android:resource": "@xml/shortcuts" } });
    return mod;
  });
};
