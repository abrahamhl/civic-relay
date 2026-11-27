// Copyright (c) 2026 Abraham Haddioui / Civic Relay. All rights reserved.
// PROPRIETARY & CONFIDENTIAL SOVEREIGN INTELLECTUAL PROPERTY.
package com.civicrelay.oep.atak

import android.content.Context
import android.util.Log
import com.atakmap.android.cot.CotMapComponent
import com.atakmap.coremap.cot.event.CotDetail
import com.atakmap.coremap.cot.event.CotEvent
import com.atakmap.coremap.cot.event.CotPoint
import com.atakmap.coremap.maps.time.CoordinatedTime
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Service bridging native OEP Binary Bursts with ATAK Cursor-on-Target (CoT).
 */
class OepCotBridgeService(private val context: Context) {

    companion object {
        private const val TAG = "OepCotBridge"
        private const val HOW_RELAY = "m-r" // Machine-Radio
    }

    /**
     * Ingests a raw decrypted OEP byte buffer and broadcasts it to ATAK Map Engine.
     */
    fun processInboundOepBuffer(rawBytes: ByteArray) {
        if (rawBytes.size < 24) {
            Log.e(TAG, "Buffer too short for valid OEP header")
            return
        }

        val buffer = ByteBuffer.wrap(rawBytes).order(ByteOrder.LITTLE_ENDIAN)
        val magic = buffer.get()
        if (magic != 0x5E.toByte()) {
            Log.w(TAG, "Invalid magic header: $magic")
            return
        }

        val timestampSeconds = buffer.int.toLong() and 0xFFFFFFFFL
        val sourceNodeId = buffer.int
        val latFixed = buffer.int
        val lonFixed = buffer.int
        val altMeters = buffer.short.toDouble()
        val messageType = buffer.get().toInt()
        val verificationFlags = buffer.get().toInt()

        val lat = latFixed / 1e7
        val lon = lonFixed / 1e7

        val cotEvent = buildCotEvent(
            sourceId = sourceNodeId,
            lat = lat,
            lon = lon,
            alt = altMeters,
            msgType = messageType,
            verificationFlags = verificationFlags
        )

        // Dispatch directly into ATAK's native internal bus
        CotMapComponent.getExternalDispatcher()?.dispatch(cotEvent)
        Log.i(TAG, "Dispatched OEP event to ATAK: UID=${cotEvent.uid}, Type=${cotEvent.type}")
    }

    private fun buildCotEvent(
        sourceId: Int,
        lat: Double,
        lon: Double,
        alt: Double,
        msgType: Int,
        verificationFlags: Int
    ): CotEvent {
        val now = CoordinatedTime()
        val stale = CoordinatedTime(now.milliseconds + 3600 * 1000) // 1 hr validity

        val cotType = when (msgType) {
            0x01 -> "b-m-p-s-m"       // SOS / Emergency Distress
            0x02 -> "a-f-G-U-C"       // Civilian Status: Safe
            0x03 -> "a-f-G-U-C-I"     // Civilian Injured / Medical
            0x04 -> "b-d-n"           // Incident Fire
            0x05 -> "b-m-o-b"         // Road Blocked / Obstacle
            else -> "a-u-G"           // Unknown Ground Object
        }

        val uid = "OEP-NODE-${Integer.toHexString(sourceId).uppercase()}"
        val event = CotEvent()
        event.version = "2.0"
        event.uid = uid
        event.type = cotType
        event.how = HOW_RELAY
        event.time = now
        event.start = now
        event.stale = stale

        // Standard 95% circular error estimates
        event.point = CotPoint(lat, lon, alt, 10.0, 5.0)

        val detail = CotDetail("detail")
        val contact = CotDetail("contact")
        contact.setAttribute("callsign", "OEP-$sourceId")
        detail.addChild(contact)

        val oepDetail = CotDetail("oep_status")
        oepDetail.setAttribute("verified", (verificationFlags and 0x01 != 0).toString())
        oepDetail.setAttribute("corroborated", (verificationFlags and 0x02 != 0).toString())
        detail.addChild(oepDetail)

        if (msgType == 0x01) {
            val emergency = CotDetail("emergency")
            emergency.setAttribute("type", "Life Safety SOS")
            emergency.setAttribute("cancel", "false")
            detail.addChild(emergency)
        }

        event.detail = detail
        return event
    }
}
