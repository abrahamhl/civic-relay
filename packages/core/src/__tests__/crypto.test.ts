/**
 * E2E Encryption Tests
 * Mejora #1: Cifrado E2E - Test Suite
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeyPair,
  encryptMessage,
  signMessage,
  verifySignature,
  generateMnemonic,
} from '../crypto';
import type { MessageEnvelope } from '@civic-relay/schemas';

describe('Crypto Module - E2E Encryption', () => {
  let keyPair1: Awaited<ReturnType<typeof generateKeyPair>>;
  let keyPair2: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeAll(async () => {
    keyPair1 = await generateKeyPair();
    keyPair2 = await generateKeyPair();
  });

  describe('Key Generation', () => {
    it('should generate valid keypair', async () => {
      const kp = await generateKeyPair();
      expect(kp.publicKey).toBeTruthy();
      expect(kp.secretKey).toBeTruthy();
      expect(kp.publicKey.length).toBeGreaterThan(20);
      expect(kp.secretKey.length).toBeGreaterThan(20);
    });

    it('should generate unique keypairs', async () => {
      const kp1 = await generateKeyPair();
      const kp2 = await generateKeyPair();
      expect(kp1.publicKey).not.toBe(kp2.publicKey);
      expect(kp1.secretKey).not.toBe(kp2.secretKey);
    });

    it('should generate 12-word mnemonic', () => {
      const mnemonic = generateMnemonic(keyPair1.secretKey);
      expect(mnemonic).toHaveLength(12);
      expect(mnemonic.every(word => typeof word === 'string')).toBe(true);
    });
  });

  describe('Message Encryption', () => {
    it('should encrypt message payload', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-1',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'FIRE', location: { lat: 40.4, lon: -3.7 } },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const encrypted = await encryptMessage(message, keyPair1.publicKey);

      expect(encrypted.payload).toHaveProperty('encrypted', true);
      expect(encrypted.payload).toHaveProperty('ciphertext');
      expect(encrypted.payload).toHaveProperty('algorithm', 'XSalsa20-Poly1305');

      // Verify ciphertext is different from plaintext
      const originalPayload = JSON.stringify(message.payload);
      const encryptedPayload = JSON.stringify(encrypted.payload);
      expect(encryptedPayload).not.toContain('FIRE');
      expect(encryptedPayload).not.toBe(originalPayload);
    });

    it('should produce different ciphertexts for same message', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-2',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'MEDICAL' },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const encrypted1 = await encryptMessage(message, keyPair1.publicKey);
      const encrypted2 = await encryptMessage(message, keyPair1.publicKey);

      // Different nonces should produce different ciphertexts
      expect(encrypted1.payload.ciphertext).not.toBe(encrypted2.payload.ciphertext);
    });
  });

  describe('Message Signing', () => {
    it('should sign message', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-3',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'INFRASTRUCTURE' },
        priority: 'HIGH',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const signature = await signMessage(message, keyPair1.secretKey);
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(20);
    });

    it('should verify valid signature', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-4',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'FIRE' },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const signature = await signMessage(message, keyPair1.secretKey);
      const isValid = await verifySignature(message, signature, keyPair1.publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject tampered message', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-5',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'FIRE' },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const signature = await signMessage(message, keyPair1.secretKey);

      // Tamper with message
      const tamperedMessage = { ...message, payload: { type: 'MEDICAL' } };

      const isValid = await verifySignature(tamperedMessage, signature, keyPair1.publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject signature from wrong key', async () => {
      const message: MessageEnvelope = {
        id: 'test-msg-6',
        payloadType: 'EMERGENCY_ALERT',
        payload: { type: 'FIRE' },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-1' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      const signature = await signMessage(message, keyPair1.secretKey);

      // Try to verify with different public key
      const isValid = await verifySignature(message, signature, keyPair2.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Integration Test', () => {
    it('should encrypt, sign, and verify complete flow', async () => {
      const originalMessage: MessageEnvelope = {
        id: 'test-msg-integration',
        payloadType: 'EMERGENCY_ALERT',
        payload: {
          type: 'WILDFIRE',
          location: { lat: 40.4168, lon: -3.7038 },
          severity: 'EXTREME',
          description: 'Incendio forestal activo - Evacuación inmediata'
        },
        priority: 'CRITICAL',
        ttl: 300,
        maxHops: 5,
        createdAt: new Date().toISOString(),
        sender: { deviceId: 'device-sender' },
        verificationState: 'UNVERIFIED',
        deliveryHistory: [],
      };

      // 1. Encrypt
      const encrypted = await encryptMessage(originalMessage, keyPair2.publicKey);
      expect(encrypted.payload).toHaveProperty('encrypted', true);

      // 2. Sign
      const signature = await signMessage(encrypted, keyPair1.secretKey);
      expect(signature).toBeTruthy();

      // 3. Verify signature
      const isValid = await verifySignature(encrypted, signature, keyPair1.publicKey);
      expect(isValid).toBe(true);

      // 4. Verify tampered message fails
      const tamperedEncrypted = {
        ...encrypted,
        payload: { ...encrypted.payload, ciphertext: 'FAKE_CIPHERTEXT' }
      };
      const isTamperedValid = await verifySignature(tamperedEncrypted, signature, keyPair1.publicKey);
      expect(isTamperedValid).toBe(false);
    });
  });
});
