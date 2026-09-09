/**
 * Cifrado End-to-End usando libsodium (NaCl)
 * Mejora #1: Cifrado E2E - CRÍTICO para CCN-CERT
 */

import type { MessageEnvelope } from '@civic-relay/schemas';
import sodium from 'libsodium-wrappers-sumo';

// Lazy-loaded sodium instance
let sodiumReady = false;

async function getSodium() {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
  return sodium;
}

/**
 * Key pair for device identity
 */
export interface KeyPair {
  publicKey: string;  // Base64 encoded
  secretKey: string;  // Base64 encoded, NEVER share
}

/**
 * Generate new keypair for device
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const lib = await getSodium();
  const signingKeys = lib.crypto_sign_keypair();

  return {
    publicKey: lib.to_base64(signingKeys.publicKey),
    secretKey: lib.to_base64(signingKeys.privateKey),
  };
}

/**
 * Store keypair securely in localStorage (encrypted with Web Crypto API)
 */
export async function storeKeyPair(keyPair: KeyPair, passphrase: string): Promise<void> {
  try {
    // Derive key from passphrase
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Encrypt secret key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(keyPair.secretKey)
    );

    // Store in localStorage
    localStorage.setItem('civic-relay-keypair', JSON.stringify({
      publicKey: keyPair.publicKey,
      encryptedSecretKey: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
    }));
  } catch (error) {
    console.error('Failed to store keypair:', error);
    throw new Error('Key storage failed');
  }
}

/**
 * Encrypt message payload
 */
export async function encryptMessage(
  message: MessageEnvelope,
  recipientPublicKey: string
): Promise<MessageEnvelope> {
  const lib = await getSodium();

  // Convert payload to bytes
  const payloadBytes = new TextEncoder().encode(JSON.stringify(message.payload));

  // Encrypt with recipient's public key (sealed box)
  const recipientPubKey = lib.from_base64(recipientPublicKey);
  const ciphertext = lib.crypto_box_seal(payloadBytes, recipientPubKey);

  // Replace payload with encrypted version
  return {
    ...message,
    payload: {
      encrypted: true,
      ciphertext: lib.to_base64(ciphertext),
      algorithm: 'XSalsa20-Poly1305',
    },
  };
}

/**
 * Sign message for integrity verification
 */
export async function signMessage(
  message: MessageEnvelope,
  secretKey: string
): Promise<string> {
  const lib = await getSodium();

  // Serialize message (excluding signature)
  const messageBytes = new TextEncoder().encode(JSON.stringify({
    id: message.id,
    payload: message.payload,
    createdAt: message.createdAt,
  }));

  // Sign with secret key
  const secretKeyBytes = lib.from_base64(secretKey);
  const signature = lib.crypto_sign_detached(messageBytes, secretKeyBytes);

  return lib.to_base64(signature);
}

/**
 * Verify message signature
 */
export async function verifySignature(
  message: MessageEnvelope,
  signature: string,
  publicKey: string
): Promise<boolean> {
  const lib = await getSodium();

  const messageBytes = new TextEncoder().encode(JSON.stringify({
    id: message.id,
    payload: message.payload,
    createdAt: message.createdAt,
  }));

  const signatureBytes = lib.from_base64(signature);
  const publicKeyBytes = lib.from_base64(publicKey);

  return lib.crypto_sign_verify_detached(signatureBytes, messageBytes, publicKeyBytes);
}

/**
 * Generate mnemonic (12 words) for key backup
 */
export function generateMnemonic(secretKey: string): string[] {
  // Simplified version - in production use BIP39 wordlist
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    // ... (full BIP39 wordlist would go here)
  ];

  // Convert secret key to indices
  const bytes = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0));
  const mnemonic: string[] = [];

  for (let i = 0; i < 12; i++) {
    const index = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    mnemonic.push(words[index % words.length]);
  }

  return mnemonic;
}

/**
 * Key management utilities
 */
export const CryptoManager = {
  generateKeyPair,
  storeKeyPair,
  encryptMessage,
  signMessage,
  verifySignature,
  generateMnemonic,
};
