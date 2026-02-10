// ============================================================================
// Wallet Screen — Zero Auth Wallet Management
// Face ID only. No keys visible. No keys stored in memory.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Clipboard } from 'react-native';
import { colors, spacing, radius } from '../services/theme';
import { getWalletAddress, authenticateHuman, deleteWallet, signZeroAuth } from '../services/zero-auth';
import * as api from '../services/api';

export default function WalletScreen({ navigation }) {
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [roofBalance, setRoofBalance] = useState(null);
  const [lastSig, setLastSig] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const addr = await getWalletAddress();
    setWallet(addr);
    try {
      const bal = await api.getBalance();
      setBalance(bal);
    } catch {}
    if (addr) {
      try {
        const roof = await api.getRoofBalance(addr);
        setRoofBalance(roof?.roof);
      } catch {}
    }
  }

  async function handleCopyAddress() {
    if (wallet) {
      Clipboard.setString(wallet);
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    }
  }

  async function handleTestSign() {
    try {
      const result = await signZeroAuth(0);
      setLastSig(result.signature.slice(0, 20) + '...');
      Alert.alert('Signed', `Zero Auth signature verified.\nWallet: ${result.wallet.slice(0, 8)}...`);
    } catch (e) {
      Alert.alert('Failed', e.message);
    }
  }

  async function handleDeleteWallet() {
    Alert.alert(
      'Delete Wallet',
      'This is IRREVERSIBLE. Your keypair will be destroyed. You will lose access to all funds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet();
              navigation.replace('Auth');
            } catch (e) {
              Alert.alert('Failed', e.message);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>Zero Auth — No Keys Visible</Text>

      {/* Address Card */}
      <View style={styles.card}>
        <Text style={styles.label}>SOLANA ADDRESS</Text>
        <Text style={styles.address}>{wallet || 'No wallet'}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyAddress}>
          <Text style={styles.copyText}>Copy Address</Text>
        </TouchableOpacity>
      </View>

      {/* Balances */}
      <View style={styles.balanceRow}>
        <View style={styles.balanceCard}>
          <Text style={styles.label}>SOL</Text>
          <Text style={styles.balanceValue}>{balance?.balance?.sol?.toFixed(4) || '0.0000'}</Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.label}>USD</Text>
          <Text style={styles.balanceValue}>${balance?.balance?.usd?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceCard}>
          <Text style={styles.label}>BRIC</Text>
          <Text style={[styles.balanceValue, { color: colors.teal }]}>0</Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.label}>ROOF (ETH)</Text>
          <Text style={[styles.balanceValue, { color: colors.success }]}>
            {roofBalance?.balance?.toLocaleString() || '0'}
          </Text>
          {roofBalance?.hasRoof && <Text style={styles.hasRoof}>HAS ROOF</Text>}
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.signButton} onPress={handleTestSign}>
        <Text style={styles.signText}>Test Zero Auth Signature</Text>
      </TouchableOpacity>
      {lastSig && <Text style={styles.sigResult}>Last sig: {lastSig}</Text>}

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteWallet}>
        <Text style={styles.deleteText}>Delete Wallet</Text>
      </TouchableOpacity>

      <Text style={styles.notice}>
        Private key stored in device Secure Enclave.{'\n'}
        Never leaves this device. Never visible to apps.{'\n'}
        Face ID required for all transactions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
  subtitle: { fontSize: 12, color: colors.teal, letterSpacing: 2, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  label: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.xs },
  address: { fontSize: 13, color: colors.silver, fontFamily: 'monospace', marginBottom: spacing.md },
  copyButton: {
    backgroundColor: colors.bgElevated, borderRadius: radius.sm,
    padding: spacing.sm, alignItems: 'center',
  },
  copyText: { fontSize: 12, color: colors.teal },
  balanceRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  balanceCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  balanceValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  hasRoof: { fontSize: 10, color: colors.success, letterSpacing: 2, marginTop: 4 },
  signButton: {
    backgroundColor: colors.teal, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  signText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  sigResult: { fontSize: 11, color: colors.textDim, fontFamily: 'monospace', marginTop: spacing.sm, textAlign: 'center' },
  deleteButton: {
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.error,
  },
  deleteText: { fontSize: 14, color: colors.error },
  notice: {
    fontSize: 11, color: colors.textDim, textAlign: 'center',
    lineHeight: 18, marginTop: spacing.lg,
  },
});
