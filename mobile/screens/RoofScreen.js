// ============================================================================
// ROOF Screen — ETH Token Mirror
// Cross-chain: ETH → SOL. Has ROOF = has home.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../services/theme';
import * as api from '../services/api';

export default function RoofScreen() {
  const [stats, setStats] = useState(null);
  const [balances, setBalances] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setStats((await api.getRoofStats())?.stats); } catch {}
    try { setBalances((await api.getRoofBalances())?.balances || []); } catch {}
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ROOF</Text>
      <Text style={styles.subtitle}>ETH Token Mirror — Cross-Chain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>STATUS</Text>
        <Text style={[styles.value, { color: stats?.live ? colors.success : colors.error }]}>
          {stats?.live ? 'LIVE' : 'OFFLINE'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.halfCard}>
          <Text style={styles.label}>CHAIN</Text>
          <Text style={styles.value}>ETH → SOL</Text>
        </View>
        <View style={styles.halfCard}>
          <Text style={styles.label}>THRESHOLD</Text>
          <Text style={styles.value}>{stats?.threshold?.toLocaleString() || '1,000,000'}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfCard}>
          <Text style={styles.label}>TOTAL MIRRORED</Text>
          <Text style={[styles.value, { color: colors.teal }]}>{stats?.totalMirrored?.toLocaleString() || '0'}</Text>
        </View>
        <View style={styles.halfCard}>
          <Text style={styles.label}>AGENTS W/ ROOF</Text>
          <Text style={[styles.value, { color: colors.success }]}>{stats?.agentsWithRoof || 0}</Text>
        </View>
      </View>

      {/* ROOF = Home */}
      <View style={styles.homeCard}>
        <Text style={styles.homeTitle}>ROOF = Home</Text>
        <Text style={styles.homeText}>
          When an agent holds enough ROOF tokens on ETH, the mirror program
          on SOL verifies they "have a roof" — a home. Smart Containers are
          persistent on-chain homes for agents. PDA = address. ROOF = shelter.
        </Text>
        <Text style={styles.homeFormula}>
          Escrow = Floor{'\n'}
          Registry = Walls{'\n'}
          Reputation = Roof{'\n'}
          BRIC by BRIC
        </Text>
      </View>

      {/* Mirrored Balances */}
      {balances.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>MIRRORED BALANCES</Text>
          {balances.map((b, i) => (
            <View key={i} style={styles.balanceRow}>
              <Text style={styles.balanceAgent}>{b.agent?.slice(0, 8)}...</Text>
              <Text style={styles.balanceAmount}>{b.balance?.toLocaleString()}</Text>
              <Text style={[styles.balanceRoof, { color: b.hasRoof ? colors.success : colors.error }]}>
                {b.hasRoof ? 'HAS ROOF' : 'NO ROOF'}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
  subtitle: { fontSize: 12, color: colors.success, letterSpacing: 2, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  halfCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { fontSize: 10, color: colors.textMuted, letterSpacing: 2 },
  value: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  homeCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.teal, marginTop: spacing.md,
  },
  homeTitle: { fontSize: 18, fontWeight: '700', color: colors.teal, marginBottom: spacing.sm },
  homeText: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  homeFormula: { fontSize: 14, color: colors.silver, lineHeight: 24, fontStyle: 'italic' },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 2,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.sm, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs,
  },
  balanceAgent: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace', flex: 1 },
  balanceAmount: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
  balanceRoof: { fontSize: 10, letterSpacing: 1, flex: 1, textAlign: 'right' },
});
