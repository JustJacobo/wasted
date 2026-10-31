// Firma del APK de release con el keystore de siempre (el de la app anterior),
// para que se instale encima. Lee mobile/keystore.properties, fuera de git (en
// CI lo escribe el workflow): storeFile, storePassword, keyAlias y keyPassword.
// Sin ese archivo el release sale con la firma debug: sirve para probar en el
// emulador, pero no se instala encima de la app publicada.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// with-release-signing";

const LOAD = `${MARK}: keystore de mobile/keystore.properties
def wastedKeystore = new Properties()
def wastedKeystoreFile = rootProject.file("../keystore.properties")
if (wastedKeystoreFile.exists()) wastedKeystoreFile.withInputStream { wastedKeystore.load(it) }

`;

const CONFIG = `
        release {
            if (wastedKeystoreFile.exists()) {
                storeFile file(wastedKeystore.storeFile)
                storePassword wastedKeystore.storePassword
                keyAlias wastedKeystore.keyAlias
                keyPassword wastedKeystore.keyPassword
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(MARK)) return mod;

    const signingDebug = /(signingConfigs \{\n\s+debug \{[^}]*\})/;
    const releaseUsesDebug = /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/;
    if (!signingDebug.test(gradle) || !releaseUsesDebug.test(gradle) || !gradle.includes("\nandroid {")) {
      throw new Error("with-release-signing: app/build.gradle no tiene la forma esperada; revisa el plugin.");
    }
    gradle = gradle.replace("\nandroid {", `\n${LOAD}android {`);
    gradle = gradle.replace(signingDebug, `$1${CONFIG}`);
    gradle = gradle.replace(releaseUsesDebug, "$1signingConfig wastedKeystoreFile.exists() ? signingConfigs.release : signingConfigs.debug");
    mod.modResults.contents = gradle;
    return mod;
  });
};
