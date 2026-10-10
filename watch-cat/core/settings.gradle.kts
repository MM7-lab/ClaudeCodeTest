// Lets the shared core be built and tested on its own (the Android app isn't needed for that).
pluginManagement {
    repositories { gradlePluginPortal(); mavenCentral() }
    plugins { kotlin("jvm") version "2.0.21" }
}
dependencyResolutionManagement { repositories { mavenCentral() } }
rootProject.name = "core"
