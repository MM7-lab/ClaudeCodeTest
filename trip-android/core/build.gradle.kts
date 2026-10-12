import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Plain Kotlin, no Android: reading amounts out of payment notifications, tested on any JVM.
plugins {
    kotlin("jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
