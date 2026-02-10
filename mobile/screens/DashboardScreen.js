// ============================================================================
// Dashboard Screen — Economy Overview
// Zero Auth verified. Face = identity. Chain = authority.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../services/theme';
import { getWalletAddress } from '../services/zero-auth';
import * as api from '../services/api';

export default function DashboardScreen({ navigation }) {
  const [wallet, setWallet] = useState(null);
  const [economy, setEconomy] = useState(null);
  const [agents, setAgents] = useState([]);
  const [roofStats, setRoofStats] = useState(null);
  const [bridgeStats, setBridgeStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const addr = await getWalletAddress();
      setWallet(addr);
    } catch {}

    try {
      await api.checkHealth();
      setServerOnline(true);
    } catch {
      setServerOnline(false);
      return;
    }

    try { setEconomy(await api.getEconomy()); } catch {}
    try { setAgents((await api.getAgents())?.agents || []); } catch {}
    try { setRoofStats((await api.getRoofStats())?.stats || null); } catch {}
    try { setBridgeStats((await api.getBridgeStats())?.stats || null); } catch {}
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  function StatCard({ label, value, sub, color: cardColor }) {
    return (
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, cardColor && { color: cardColor }]}>{value}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
    );
  }

  function AgentRow({ agent }) {
    const isSuspended = agent.securityRole === 'suspended';
    return (
      <View style={[styles.agentRow, isSuspended && styles.agentSuspended]}>
        <Text style={styles.agentEmoji}>{agent.emoji}</Text>
        <View style={styles.agentInfo}>
          <Text style={[styles.agentName, isSuspended && styles.textSuspended]}>{agent.name}</Text>
          <Text style={styles.agentRole}>{agent.role} / {agent.model}</Text>
        </View>
        <View style={[styles.roleBadge, isSuspended && styles.roleSuspended]}>
          <Text style={styles.roleText}>{agent.securityRole || 'agent'}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>CAN_</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, serverOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>{serverOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      {/* Wallet */}
      <TouchableOpacity style={styles.walletCard} onPress={() => navigation.navigate('Wallet')}>
        <Text style={styles.walletLabel}>YOUR WALLET</Text>
        <Text style={styles.walletAddress}>
          {wallet ? wallet.slice(0, 12) + '...' + wallet.slice(-8) : 'No wallet'}
        </Text>
        <Text style={styles.walletAuth}>Zero Auth Active</Text>
      </TouchableOpacity>

      {/* Economy Stats */}
      <Text style={styles.sectionTitle}>Economy</Text>
      <View style={styles.statGrid}>
        <StatCard label="Architecture" value={economy?.architecture || '---'} />
        <StatCard label="Storage" value={economy?.storage || '---'} />
        <StatCard label="Database" value={economy?.database || '---'} />
        <StatCard label="Uptime" value={economy?.uptimeSeconds ? `${Math.floor(economy.uptimeSeconds / 60)}m` : '---'} />
      </View>

      {/* Token Stats */}
      <Text style={styles.sectionTitle}>Tokens</Text>
      <View style={styles.statGrid}>
        <StatCard label="BRIC" value="1,000,000" sub="on SOL" color={colors.teal} />
        <StatCard
          label="ROOF"
          value={roofStats?.totalMirrored?.toLocaleString() || '0'}
          sub={roofStats?.live ? 'ETH LIVE' : 'mirror'}
          color={colors.success}
        />
        <StatCard
          label="Bridge"
          value={bridgeStats?.totalTransactions?.toString() || '0'}
          sub="transfers"
        />
        <StatCard label="Data Mining" value="NONE" color={colors.error} />
      </View>

      {/* Agents */}
      <Text style={styles.sectionTitle}>Agents</Text>
      <View style={styles.agentList}>
        {agents.length > 0 ? (
          agents.map(a => <AgentRow key={a.id} agent={a} />)
        ) : (
          <Text style={styles.emptyText}>Connect to server to load agents</Text>
        )}
      </View>

      {/* Navigation */}
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Wallet')}>
          <Text style={styles.actionText}>Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Tasks')}>
          <Text style={styles.actionText}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Roof')}>
          <Text style={styles.actionText}>ROOF</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>BRIC by BRIC</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  logo: { fontSize: 28, fontWeight: '700', color: colors.silverLight, letterSpacing: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  dotOnline: { backgroundColor: colors.success },
  dotOffline: { backgroundColor: colors.error },
  statusText: { fontSize: 12, color: colors.textMuted },
  walletCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.teal, marginBottom: spacing.lg,
  },
  walletLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 3, marginBottom: spacing.xs },
  walletAddress: { fontSize: 14, color: colors.silver, fontFamily: 'monospace', marginBottom: spacing.xs },
  walletAuth: { fontSize: 12, color: colors.teal },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    flex: 1, minWidth: '45%', borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  statSub: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  agentList: { gap: spacing.sm },
  agentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  agentSuspended: { borderColor: colors.suspended, opacity: 0.5 },
  agentEmoji: { fontSize: 24, marginRight: spacing.md },
  agentInfo: { flex: 1 },
  agentName: { fontSize: 14, fontWeight: '600', color: colors.text },
  textSuspended: { color: colors.suspended, textDecorationLine: 'line-through' },
  agentRole: { fontSize: 11, color: colors.textMuted },
  roleBadge: {
    backgroundColor: colors.tealDark, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  roleSuspended: { backgroundColor: colors.suspended },
  roleText: { fontSize: 10, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  actionGrid: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.teal },
  emptyText: { fontSize: 12, color: colors.textDim, textAlign: 'center', padding: spacing.lg },
  footer: {
    fontSize: 10, color: colors.textDim, letterSpacing: 4, textTransform: 'uppercase',
    textAlign: 'center', marginTop: spacing.xl,
  },
});
