plugins {
    id("com.android.application")
}

// The ledger UI is the same web app that lives in docs/ledger; it is copied into the APK at build time.
val webDir = rootProject.file("../docs/ledger")
val webAssets = layout.buildDirectory.dir("generated/web-assets")
val copyWeb = tasks.register<Copy>("copyWeb") {
    from(webDir) { exclude("sw.js") }
    into(webAssets.map { it.dir("www") })
}

android {
    namespace = "hk.mm7.ledger"
    compileSdk = 35

    defaultConfig {
        applicationId = "hk.mm7.ledger"
        minSdk = 29
        targetSdk = 34
        val run = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionCode = run
        versionName = "1.0.$run"
    }

    // One shared key so every build installs over the previous one. See android/README.md.
    signingConfigs {
        create("shared") {
            storeFile = file("ledger-shared.keystore")
            storePassword = "mm7ledger"
            keyAlias = "ledger"
            keyPassword = "mm7ledger"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("shared")
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("shared")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(webAssets)

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    testImplementation("junit:junit:4.13.2")
}
