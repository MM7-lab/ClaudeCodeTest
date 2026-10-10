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
        versionCode = 1
        versionName = "1.0.0"
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

dependencies {
    implementation(project(":core"))

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
