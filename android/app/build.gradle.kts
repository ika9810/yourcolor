import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseKeyFile = rootProject.file("keystore.properties")
val releaseKey = Properties().apply {
    if (releaseKeyFile.isFile) releaseKeyFile.inputStream().use(::load)
}

require(!file("src/main/assets/adi-registration.properties").exists()) {
    "Remove account-specific adi-registration.properties before building the app"
}

android {
    namespace = "com.robotics.yourcolor"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.robotics.yourcolor"
        minSdk = 24
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
        targetSdk = 36
        versionCode = 6
        versionName = "2.0.2"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (releaseKeyFile.isFile) create("release") {
            val required = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
            require(required.all { !releaseKey.getProperty(it).isNullOrBlank() }) {
                "keystore.properties requires storeFile, storePassword, keyAlias, and keyPassword"
            }
            storeFile = file(releaseKey.getProperty("storeFile"))
            require(storeFile!!.isFile) { "Release keystore file was not found" }
            storePassword = releaseKey.getProperty("storePassword")
            keyAlias = releaseKey.getProperty("keyAlias")
            keyPassword = releaseKey.getProperty("keyPassword")
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".dev"; versionNameSuffix = "-dev" }
        release {
            isMinifyEnabled = false
            if (releaseKeyFile.isFile) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.24.3")
    implementation("androidx.window:window:1.4.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.exifinterface:exifinterface:1.4.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:rules:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
