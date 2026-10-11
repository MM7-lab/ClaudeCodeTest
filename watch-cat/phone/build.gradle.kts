import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    kotlin("android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    // same code namespace as the watch app (they share code), but its own app id
    namespace = "hk.mm7lab.watchcat"
    compileSdk = 35

    defaultConfig {
        applicationId = "hk.mm7lab.watchcat.phone"
        minSdk = 29
        targetSdk = 34
        versionCode = 3
        versionName = "1.1.1"
    }

    signingConfigs {
        create("sideload") {
            storeFile = file("../keystore/sideload.jks")
            storePassword = "watchcat"
            keyAlias = "watchcat"
            keyPassword = "watchcat"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("sideload")
        }
        debug { signingConfig = signingConfigs.getByName("sideload") }
    }

    sourceSets["main"].apply {
        java.srcDir("../shared/src/main/kotlin")
        res.srcDir("../shared/src/main/res")
        assets.srcDir("../shared/src/main/assets")
        // the desktop app's 3D world, copied in at build time (see copyDesk below)
        assets.srcDir(layout.buildDirectory.dir("generated/deskAssets").get().asFile)
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }

// The scene on the home screen is the desktop app's own pet page (desktop-cat/pet), run in a
// WebView. Copy it in, with three.js, and load the phone bridge before the pets.
val copyDesk by tasks.registering(Sync::class) {
    val desk = rootProject.file("../desktop-cat")
    doFirst {
        check(File(desk, "node_modules/three/build/three.module.js").exists()) {
            "three.js is missing: run `npm ci --omit=dev --ignore-scripts` in desktop-cat first"
        }
    }
    from(desk) {
        include("pet/**", "toys/**", "node_modules/three/build/three.module.js", "node_modules/three/build/three.core.js", "node_modules/three/LICENSE")
        filesMatching("pet/index.html") {
            filter { line ->
                line.replace(
                    "<script type=\"module\" src=\"pet.js\"></script>",
                    "<script src=\"phone-bridge.js\"></script>\n<script type=\"module\" src=\"pet.js\"></script>",
                )
            }
        }
    }
    into(layout.buildDirectory.dir("generated/deskAssets/desk"))
}
tasks.named("preBuild") { dependsOn(copyDesk) }

dependencies {
    implementation(project(":core"))

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
