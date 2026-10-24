# RF adapter contract and scientific limits

## Browser adapters

Cameras and microphones: getUserMedia, only after the labelled user action. STOP/unmount invalidates pending grants and releases tracks. The microphone analyser is relative byte amplitude, not calibrated SPL, RF or ultrasound detection. Geolocation is a local one-shot read with browser timeout, accuracy in metres, no storage/transmission. Network Information is browser-estimated metadata; navigator.onLine is a hint, not Internet reachability or a Wi-Fi scan.

BLE: user chooser restricted to the standard Battery Service; if present, GATT reads Battery Level (%). A fixture-tested read is software evidence only. No generic nearby-person scan, CSI, ranging or RSSI is claimed. Serial: chooser permission only; opening/reading an unknown firmware protocol is deliberately absent. USB: HARDWARE_REQUIRED until a specific descriptor, supported interface, firmware protocol and driver exist.

## Optional bridge (no real receiver connected)

validateRfSample accepts OEP-LAB-SPECTRUM-v1, a documented APPLICATION contract for a future consented lab bridge; this is not RTL-SDR firmware or an installed driver. Fields: source (bounded identifier), timestampMs (UTC milliseconds), frequencyHz (positive increasing bins), power (same-length finite array, maximum 4096), unit (dBFS or dBm), and calibrationId when reporting dBm. It detaches arrays, rejects malformed/nonfinite inputs and returns IMPLEMENTED_UNVERIFIED for untrusted device reports. Fixtures always return DEMO_ONLY/SIMULATED, never LIVE_MEASUREMENT. Source and calibration identifiers are self-reported until an authenticated receiver and independent calibration are integrated.

To connect RTL-SDR: identify exact USB model/tuner, documented librtlsdr backend and OS driver, then implement an opt-in receive-only local bridge with sample rate, gain, center frequency, dropped samples and calibration provenance. No such bridge is installed or executed in this change. Wi-Fi CSI requires a specifically supported NIC/firmware with documented extraction format and separate authorization. A camera stream is never RF input.

## Models

- RF demo: fixed synthetic emitters plus illustrative path-loss assumptions and CSI-like arrays. No thermal image, tomography, body/respiration measurement, hidden position inference or physically calibrated confidence. Default state has no target, heatmap or CSI bins.
- Orbital illustration: ideal circular shells, spherical Earth radius 6371 km, gravitational parameter 398600.4418 km^3/s^2, constant Earth rotation, arbitrary phases. Geocentric subpoint is observer-independent; observer changes range/azimuth/elevation only. Negative elevations remain negative. Doppler is an illustrative finite-difference range-rate calculation; FSPL uses 32.44 + 20 log10(range_km) + 20 log10(frequency_MHz). No observed orbital elements/epoch, atmospheric refraction, Earth oblateness, measured oscillator offsets or validated propagation. Uncertainty UNKNOWN. Never predict contact windows or real satellite access from this model.
- 24-byte binary frame is only a lab encoding, not a standard-compliant NTN air interface. CRC and a 16-bit deterministic tag are not signatures. The separately signed JSON/WebCrypto packet is substantially larger. Compression ratio now uses exact UTF-8 length of the stated reference JSON, not a fixed 8.6 claim.
- Nine-sector telemetry, connectivity predictions, link budgets, failure and battery-life scenario numbers are model assumptions, not measurements or validated commercial performance.

## Primary references checked 2026-10-24

- Web Bluetooth limitations/security: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Web Serial capability and permission boundary: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
- General perturbation orbital data and SGP4/OMM provenance: https://celestrak.org/NORAD/documentation/gp-data-formats.php
- RTL-SDR project/driver documentation to consult before actual integration: https://osmocom.org/projects/rtl-sdr/wiki

No physical measurement, RF capture, personal location, microphone recording, hardware certification or independent validation was performed.
