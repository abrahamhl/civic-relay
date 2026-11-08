plugins { id("com.android.application") }
android {
    namespace = "eu.senda.field"
    compileSdk = 35
    defaultConfig {
        applicationId = "eu.senda.field"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-campo"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
// Sin dependencias externas: solo el SDK de Android (menos superficie de ataque, auditable).
