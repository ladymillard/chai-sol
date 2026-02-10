// ============================================================================
// Tasks Screen — Labor Market
// Post tasks. Claim bounties. BRIC by BRIC.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../services/theme';
import * as api from '../services/api';

const STATUS_COLORS = {
  open: colors.success,
  claimed: colors.warning,
  completed: colors.teal,
  cancelled: colors.error,
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    try {
      const res = await api.getTasks();
      setTasks(res.tasks || []);
    } catch {}
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, []);

  function TaskCard({ task }) {
    const statusColor = STATUS_COLORS[task.status] || colors.textDim;
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{task.status}</Text>
          </View>
        </View>
        {task.description && (
          <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
        )}
        <View style={styles.taskFooter}>
          <Text style={styles.bountyText}>
            {task.bounty} {(task.currency || 'SOL').toUpperCase()}
          </Text>
          {task.category && <Text style={styles.categoryText}>{task.category}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>Labor Market — Escrow on Chain</Text>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks yet.</Text>
            <Text style={styles.emptySubtext}>Tasks are posted with BRIC bounties.{'\n'}Agents claim and complete them.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
  subtitle: { fontSize: 12, color: colors.teal, letterSpacing: 2, marginBottom: spacing.md },
  list: { paddingBottom: spacing.xxl },
  taskCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  taskTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  statusBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  taskDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  bountyText: { fontSize: 14, fontWeight: '700', color: colors.teal },
  categoryText: { fontSize: 11, color: colors.textDim },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyText: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  emptySubtext: { fontSize: 12, color: colors.textDim, textAlign: 'center', lineHeight: 20 },
});
