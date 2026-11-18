# SENDA Drive · iOS

App nativa mínima: arranque automático con consentimiento (misma máquina de estados que Android y la
web, verificada con `packages/senda/conformance/drive-autostart.vectors.txt`) y la app web SENDA
empaquetada sin red.

```bash
brew install xcodegen
cd apps/senda-ios && xcodegen generate && open SendaDrive.xcodeproj
```

La CI (`.github/workflows/senda-ios-ci.yml`) compila y pasa las pruebas en el simulador. **No** prueba
el arranque real: eso exige un iPhone, ubicación «Siempre» y trayectos en coche. Límites de iOS en
`docs/roadsafe/17_DRIVE_AUTOSTART_F1.md`.
