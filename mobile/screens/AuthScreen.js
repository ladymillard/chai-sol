// ============================================================================
// Auth Screen — Face ID → Zero Auth
// No passwords. No keys. Your face is your wallet.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../services/theme';
import { isBiometricAvailable, authenticateHuman, hasWallet, createWallet, getWalletAddress } from '../services/zero-auth';

export default function AuthScreen({ navigation }) {
  const [status, setStatus] = useState('checking');  // checking | no_biometric | no_wallet | ready | error
  const [biometricType, setBiometricType] = useState('');
  const [walletAddress, setWalletAddress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    try {
      // Check biometrics
      const bio = await isBiometricAvailable();
      if (!bio.available) {
        setStatus('no_biometric');
        setError(bio.reason);
        return;
      }
      setBiometricType(bio.types[0] || 'Biometric');

      // Check wallet
      const wallet = await hasWallet();
      if (!wallet) {
        setStatus('no_wallet');
        return;
      }

      const addr = await getWalletAddress();
      setWalletAddress(addr);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }

  async function handleCreateWallet() {
    try {
      setStatus('creating');
      const { pubkey } = await createWallet();
      setWalletAddress(pubkey);
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus('no_wallet');
    }
  }

  async function handleUnlock() {
    try {
      const authed = await authenticateHuman('Unlock ChAI — verify identity');
      if (authed) {
        navigation.replace('Dashboard');
      } else {
        setError('Authentication failed');
      }
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <View style={styles.container}>
      {/* CAN_ Logo */}
      <Text style={styles.logo}>CAN_</Text>
      <Text style={styles.subtitle}>Zero Auth</Text>

      {status === 'checking' && (
        <ActivityIndicator size="large" color={colors.teal} style={styles.loader} />
      )}

      {status === 'no_biometric' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Biometrics Required</Text>
          <Text style={styles.cardText}>
            ChAI requires Face ID or fingerprint. No passwords. No keys.
            Enable biometrics in your device settings.
          </Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {status === 'no_wallet' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Wallet</Text>
          <Text style={styles.cardText}>
            Your face is your key. Face ID creates a Solana wallet
            stored in your device's secure enclave. No one else can access it.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleCreateWallet}>
            <Text style={styles.buttonText}>Create Wallet with {biometricType}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'creating' && (
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.teal} />
          <Text style={styles.cardText}>Generating keypair...</Text>
        </View>
      )}

      {status === 'ready' && (
        <View style={styles.card}>
          <Text style={styles.walletLabel}>Wallet</Text>
          <Text style={styles.walletAddress}>
            {walletAddress ? walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6) : ''}
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleUnlock}>
            <Text style={styles.buttonText}>Unlock with {biometricType}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={checkSetup}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.footer}>BRIC by BRIC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.silverLight,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.teal,
    letterSpacing: 2,
    marginBottom: spacing.xxl,
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  cardText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  walletLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  walletAddress: {
    fontSize: 16,
    color: colors.silver,
    fontFamily: 'monospace',
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    fontSize: 14,
    color: colors.teal,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xxl,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
