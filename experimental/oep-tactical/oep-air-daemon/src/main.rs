// Copyright (c) 2026 Abraham Haddioui / Civic Relay. All rights reserved.
// PROPRIETARY & CONFIDENTIAL SOVEREIGN INTELLECTUAL PROPERTY.
//! OEP-AIR-DAEMON: Embedded DTN Relay & MAVLink Micro-Burst Service
//! Target: Linux / Embedded POSIX (PX4 / ArduPilot Companion Computer)
//! Compliance: Safe Rust, zero-panic in hot loops, deterministic allocation limits.

use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_BUNDLE_PAYLOAD: usize = 220;
pub const MAX_QUEUE_CAPACITY: usize = 512;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmconLevel {
    Normal = 0,     // Open multi-radio
    Restricted = 1, // Receive-only, transmit on scheduled trigger
    Blackout = 2,   // Absolute radio silence
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OepBundle {
    pub sequence_id: u32,
    pub source_id: u32,
    pub destination_id: u32,
    pub expiry_timestamp: u64,
    pub priority: Priority,
    pub verification_flags: u8,
    pub payload_len: u8,
    pub payload: [u8; MAX_BUNDLE_PAYLOAD],
}

impl Ord for OepBundle {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority
            .cmp(&other.priority)
            .then_with(|| other.expiry_timestamp.cmp(&self.expiry_timestamp))
    }
}

impl PartialOrd for OepBundle {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct DtnQueueManager {
    queue: BinaryHeap<OepBundle>,
    capacity: usize,
    current_emcon: EmconLevel,
}

impl DtnQueueManager {
    pub fn new(capacity: usize) -> Self {
        Self {
            queue: BinaryHeap::with_capacity(capacity),
            capacity,
            current_emcon: EmconLevel::Normal,
        }
    }

    pub fn set_emcon_level(&mut self, level: EmconLevel) {
        self.current_emcon = level;
    }

    pub fn enqueue(&mut self, bundle: OepBundle) -> Result<(), &'static str> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Clock drift error")?
            .as_secs();

        if bundle.expiry_timestamp <= now {
            return Err("Bundle already expired, rejecting");
        }

        if self.queue.len() >= self.capacity {
            if let Some(lowest) = self.queue.peek() {
                if bundle.priority > lowest.priority {
                    self.queue.pop();
                } else {
                    return Err("Queue full, bundle has insufficient priority");
                }
            }
        }

        self.queue.push(bundle);
        Ok(())
    }

    pub fn pop_for_transmission(&mut self) -> Option<OepBundle> {
        if self.current_emcon == EmconLevel::Blackout {
            // Absolute radio silence: retain in persistent memory
            return None;
        }

        let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();

        while let Some(bundle) = self.queue.pop() {
            if bundle.expiry_timestamp > now {
                return Some(bundle);
            }
        }
        None
    }

    /// Serializes bundle into raw MAVLink v2 Custom Packet (Msg ID 0xBF)
    pub fn pack_mavlink_v2(&self, bundle: &OepBundle, sys_id: u8, comp_id: u8) -> Vec<u8> {
        let mut packet = Vec::with_capacity(280);
        let payload_len = 16 + (bundle.payload_len as usize);

        // MAVLink v2 Header
        packet.push(0xFD); // STX
        packet.push(payload_len as u8); // Len
        packet.push(0x00); // Incompat flags
        packet.push(0x00); // Compat flags
        packet.push((bundle.sequence_id & 0xFF) as u8); // Seq
        packet.push(sys_id); // System ID
        packet.push(comp_id); // Component ID

        // Message ID: 0x0000BF (191)
        packet.push(0xBF);
        packet.push(0x00);
        packet.push(0x00);

        // Bundle payload
        packet.extend_from_slice(&bundle.sequence_id.to_le_bytes());
        packet.extend_from_slice(&bundle.source_id.to_le_bytes());
        packet.extend_from_slice(&bundle.destination_id.to_le_bytes());
        packet.extend_from_slice(&(bundle.expiry_timestamp as u32).to_le_bytes());
        packet.push(bundle.priority as u8);
        packet.push(bundle.verification_flags);
        packet.push(bundle.payload_len);
        packet.push(0x00); // Reserved padding
        packet.extend_from_slice(&bundle.payload[..bundle.payload_len as usize]);

        // MAVLink CRC-16 MCRF4XX
        let crc = Self::compute_crc16(&packet[1..]);
        packet.extend_from_slice(&crc.to_le_bytes());

        packet
    }

    fn compute_crc16(buffer: &[u8]) -> u16 {
        let mut crc: u16 = 0xFFFF;
        for &byte in buffer {
            let mut tmp = (byte ^ (crc & 0xFF) as u8) as u16;
            tmp ^= tmp << 4;
            crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
        }
        crc
    }
}

fn main() {
    println!("[OEP-AIR-DAEMON] Initializing Tactical UAS Airborne Relay Node...");
    let mut manager = DtnQueueManager::new(MAX_QUEUE_CAPACITY);
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let sample_bundle = OepBundle {
        sequence_id: 1042,
        source_id: 0x4F7A8B12,
        destination_id: 0xFFFFFFFF,
        expiry_timestamp: now + 3600,
        priority: Priority::Critical,
        verification_flags: 0x03, // Verified & Corroborated
        payload_len: 32,
        payload: [0x5E; MAX_BUNDLE_PAYLOAD],
    };

    if let Err(e) = manager.enqueue(sample_bundle) {
        eprintln!("[ERROR] Enqueue failed: {}", e);
        return;
    }

    if let Some(bundle) = manager.pop_for_transmission() {
        let mavlink_raw = manager.pack_mavlink_v2(&bundle, 1, 68);
        println!("[OEP-AIR-DAEMON] Packed MAVLink v2 packet: {} bytes (Msg ID 0xBF)", mavlink_raw.len());
    }
}
