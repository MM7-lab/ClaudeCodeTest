import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    kotlin("android")
}

// The release signing key never lives in the repo. CI writes it from the TRIP_KEYSTORE_* secrets;
// without them the APK is signed with the build machine's throwaway debug key.
val keystorePath: String? = System.getenv("TRIP_KEYSTORE_FILE")?.takeIf { file(it).exists() }

android {
    namespace = "hk.mm7lab.tripwallet"
    compileSdk = 35

    defaultConfig {
        applicationId = "hk.mm7lab.tripwallet"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TRIP_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TRIP_KEY_ALIAS")
                keyPassword = System.getenv("TRIP_KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystorePath != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".check"
        }
    }

    // The tracker page itself (docs/japan-trip), copied in at build time so the app and the website stay one page.
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webAssets").get().asFile)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }

val copyWeb by tasks.registering(Sync::class) {
    from(rootProject.file("../docs/japan-trip")) {
        include("index.html", "*.png")
    }
    into(layout.buildDirectory.dir("generated/webAssets/web"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation(project(":core"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
