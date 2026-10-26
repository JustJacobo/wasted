import java.util.Properties

plugins {
    id("com.android.application")
}

// Firma de release: android/keystore.properties (fuera de git) apunta al
// keystore guardado fuera del repositorio. Sin él solo se compila debug.
val keystoreProps = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "app.wasted.android"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "app.wasted.android"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        val host = "wasted-lilac.vercel.app"
        buildConfigField("String", "WASTED_URL", "\"https://$host\"")
        manifestPlaceholders["host"] = host
        manifestPlaceholders["cleartext"] = "false"
        resValue("string", "asset_statements",
            "[{\\\"relation\\\": [\\\"delegate_permission/common.handle_all_urls\\\"], " +
                "\\\"target\\\": {\\\"namespace\\\": \\\"web\\\", \\\"site\\\": \\\"https://$host\\\"}}]")
    }

    signingConfigs {
        if (keystoreProps.isNotEmpty()) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        // Debug: el widget y el registro hablan con `npm run dev` (10.0.2.2 es el
        // equipo visto desde el emulador). La TWA sigue abriendo producción.
        debug {
            applicationIdSuffix = ".debug"
            buildConfigField("String", "WASTED_URL", "\"http://10.0.2.2:3000\"")
            manifestPlaceholders["cleartext"] = "true"
        }
        release {
            optimization {
                enable = false
            }
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
        resValues = true
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
