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
    // Firma de PRUEBAS DE CAMPO: clave fija (no secreta, declarada) para que cada APK nuevo se instale
    // encima del anterior sin desinstalar. NO sirve para tiendas: la clave de publicación irá como secreto.
    signingConfigs {
        create("fieldtest") {
            storeFile = rootProject.file("senda-test.keystore")
            storePassword = "senda-test"; keyAlias = "senda-test"; keyPassword = "senda-test"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("fieldtest") }
    }
    // Dos versiones (decisión del fundador, 2026-11-18):
    //  · base: SIN dependencias externas, solo el SDK de Android. Arranque automático por el Bluetooth del coche.
    //  · play: además, detección «en vehículo» de Google Play Services (pista débil, confirmada por velocidad).
    flavorDimensions += "distro"
    productFlavors {
        create("base") { dimension = "distro" }
        create("play") { dimension = "distro"; applicationIdSuffix = ".play"; versionNameSuffix = "-play" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
// Versión base: sin dependencias externas, solo el SDK de Android (menos superficie de ataque, auditable).
// Versión play: Google Play Services Location, solo para la detección «en vehículo».
dependencies {
    "playImplementation"("com.google.android.gms:play-services-location:21.3.0")
    // Android Auto / Google integrado: Car App Library (versión estable comprobada en el repositorio Maven de Google).
    "playImplementation"("androidx.car.app:app:1.7.0")
}

// La app web (investor-next/public/senda) se copia dentro del APK en cada compilación: una sola fuente
// de verdad, la misma que pasa las pruebas del núcleo y de navegador. AppActivity la sirve sin red.
val webAssets = layout.buildDirectory.dir("generated/webassets")
val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    from(rootProject.file("../../investor-next/public")) {
        include("senda/**", "geo/land-110m.json")
    }
    into(webAssets)
}
android.sourceSets.getByName("main").assets.srcDir(webAssets)
tasks.named("preBuild") { dependsOn(syncWebAssets) }
