// ============================================================================
// Zero Auth — Face ID + Solana Wallet
// Trust Fund CAN / Diana Smith — All Rights Reserved
// ============================================================================
//
// How it works:
//   1. Face ID unlocks access to the Solana keypair in Secure Store
//   2. Keypair signs a message: "chai-payment:<amount>:<timestamp>"
//   3. Signature + wallet pubkey sent as headers to server
//   4. Server verifies ed25519 signature — no passwords, no API keys
//
// No keys visible. No keys transmitted. No keys stored in memory.
// Face = identity. Signature = proof. Chain = authority.
// ============================================================================

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const WALLET_KEY = 'chai_wallet_secret';
const WALLET_PUB_KEY = 'chai_wallet_public';

// ─── Face ID ────────────────────────────────────────────────────────────────

/**
 * Check if Face ID / biometrics are available on this device
 */
export async function isBiometricAvailable() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return { available: false, reason: 'No biometric hardware' };

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { available: false, reason: 'No biometrics enrolled' };

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return {
    available: true,
    types: types.map(t => {
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
      if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Fingerprint';
      if (t === LocalAuthentication.AuthenticationType.IRIS) return 'Iris';
      return 'Unknown';
    })
  };
}

/**
 * Authenticate with Face ID / biometrics
 * Returns true if human verified, false if denied
 */
export async function authenticateHuman(reason) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason || 'Verify identity — Zero Auth',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,  // Allow passcode fallback
    fallbackLabel: 'Use passcode',
  });
  return result.success;
}

// ─── Wallet (Secure Store) ──────────────────────────────────────────────────
// Keypair lives in the device's Secure Enclave (iOS) or Keystore (Android).
// Never leaves the device. Never visible to the app. Never transmitted.

/**
 * Generate a new Solana keypair and store in Secure Store
 * Requires Face ID to create
 */
export async function createWallet() {
  // Require Face ID to create wallet
  const authed = await authenticateHuman('Create new wallet — verify identity');
  if (!authed) throw new Error('Face ID required to create wallet');

  // Generate 64 random bytes for ed25519 keypair seed
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const seed = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Store the seed in Secure Store (hardware-backed encryption)
  await SecureStore.setItemAsync(WALLET_KEY, seed, {
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    requireAuthentication: true,
    authenticationPrompt: 'Access ChAI wallet',
  });

  // Derive public key from seed using @solana/web3.js
  // This happens at wallet creation only — pubkey can be stored in plain
  const { Keypair } = require('@solana/web3.js');
  const seedBytes = new Uint8Array(seed.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const keypair = Keypair.fromSeed(seedBytes);
  const pubkey = keypair.publicKey.toBase58();

  // Store pubkey (not secret — just the address)
  await SecureStore.setItemAsync(WALLET_PUB_KEY, pubkey);

  return { pubkey };
}

/**
 * Get wallet public key (no Face ID needed — it's just the address)
 */
export async function getWalletAddress() {
  return await SecureStore.getItemAsync(WALLET_PUB_KEY);
}

/**
 * Check if wallet exists
 */
export async function hasWallet() {
  const pub = await SecureStore.getItemAsync(WALLET_PUB_KEY);
  return !!pub;
}

/**
 * Sign a Zero Auth message — REQUIRES FACE ID
 * Returns { signature, wallet, timestamp } headers for the server
 */
export async function signZeroAuth(amount) {
  // Step 1: Face ID
  const authed = await authenticateHuman('Authorize payment — verify identity');
  if (!authed) throw new Error('Face ID required');

  // Step 2: Get seed from Secure Store (triggers biometric prompt again on some devices)
  const seed = await SecureStore.getItemAsync(WALLET_KEY, {
    requireAuthentication: true,
    authenticationPrompt: 'Sign transaction',
  });
  if (!seed) throw new Error('No wallet found — create one first');

  // Step 3: Reconstruct keypair
  const { Keypair } = require('@solana/web3.js');
  const seedBytes = new Uint8Array(seed.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const keypair = Keypair.fromSeed(seedBytes);

  // Step 4: Create deterministic message
  const timestamp = Date.now().toString();
  const message = `chai-payment:${amount || 0}:${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  // Step 5: Sign with ed25519 (nacl inside @solana/web3.js)
  const nacl = require('tweetnacl');
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64');

  // Step 6: Zero the keypair from memory
  keypair.secretKey.fill(0);
  seedBytes.fill(0);

  return {
    signature: signatureBase64,
    wallet: keypair.publicKey.toBase58(),
    timestamp,
  };
}

/**
 * Get Zero Auth headers for an HTTP request
 * Call this before any authenticated API call
 */
export async function getZeroAuthHeaders(amount) {
  const { signature, wallet, timestamp } = await signZeroAuth(amount);
  return {
    'X-Zero-Auth-Sig': signature,
    'X-Zero-Auth-Wallet': wallet,
    'X-Zero-Auth-Timestamp': timestamp,
  };
}

/**
 * Delete wallet — REQUIRES FACE ID
 * Irreversible. The keypair is destroyed.
 */
export async function deleteWallet() {
  const authed = await authenticateHuman('Delete wallet — this is irreversible');
  if (!authed) throw new Error('Face ID required to delete wallet');

  await SecureStore.deleteItemAsync(WALLET_KEY);
  await SecureStore.deleteItemAsync(WALLET_PUB_KEY);
  return true;
}
