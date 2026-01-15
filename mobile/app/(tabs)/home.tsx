import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useColorScheme,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { TimeEntry, CATEGORY_COLORS, getLocalDateString } from '@/lib/types'
import { formatDuration, formatTimeDisplay } from '@/lib/time-utils'

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { user } = useAuth()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const today = getLocalDateString()

  const fetchEntries = useCallback(async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('start_time', { ascending: true })

    if (!error && data) {
      setEntries(data as TimeEntry[])
    }
    setIsLoading(false)
  }, [user, today])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEntries()
    setRefreshing(false)
  }, [fetchEntries])

  const totalMinutes = entries
    .filter(e => e.status === 'confirmed')
    .reduce((sum, e) => sum + e.duration_minutes, 0)

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Stats */}
        <View style={[styles.statsCard, isDark && styles.statsCardDark]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>
              {formatDuration(totalMinutes)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Logged today
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>
              {entries.length}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Activities
            </Text>
          </View>
        </View>

        {/* Quick Log Button */}
        <TouchableOpacity
          style={styles.quickLogButton}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color="#ffffff" />
          <Text style={styles.quickLogText}>Quick Log</Text>
        </TouchableOpacity>

        {/* Entries List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Today&apos;s Activities
          </Text>

          {entries.length === 0 ? (
            <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={isDark ? '#52525b' : '#d4d4d8'}
              />
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                No activities logged yet
              </Text>
              <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
                Tap Quick Log to add your first entry
              </Text>
            </View>
          ) : (
            <View style={styles.entriesList}>
              {entries.map(entry => {
                const categoryConfig = entry.category ? CATEGORY_COLORS[entry.category] : null

                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[styles.entryCard, isDark && styles.entryCardDark]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.entryColor,
                        { backgroundColor: categoryConfig?.color || '#71717a' },
                      ]}
                    />
                    <View style={styles.entryContent}>
                      <Text style={[styles.entryActivity, isDark && styles.entryActivityDark]}>
                        {entry.activity}
                      </Text>
                      <View style={styles.entryMeta}>
                        {entry.start_time && (
                          <Text style={[styles.entryTime, isDark && styles.entryTimeDark]}>
                            {formatTimeDisplay(entry.start_time)}
                            {entry.end_time && ` - ${formatTimeDisplay(entry.end_time)}`}
                          </Text>
                        )}
                        <Text style={[styles.entryDuration, isDark && styles.entryDurationDark]}>
                          {formatDuration(entry.duration_minutes)}
                        </Text>
                      </View>
                    </View>
                    {entry.status === 'pending' && (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingText}>Pending</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  containerDark: {
    backgroundColor: '#09090b',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsCardDark: {
    backgroundColor: '#18181b',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e4e4e7',
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18181b',
  },
  statValueDark: {
    color: '#fafafa',
  },
  statLabel: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 4,
  },
  statLabelDark: {
    color: '#a1a1aa',
  },
  quickLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  quickLogText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181b',
  },
  sectionTitleDark: {
    color: '#fafafa',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    gap: 12,
  },
  emptyStateDark: {
    backgroundColor: '#18181b',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#52525b',
  },
  emptyTextDark: {
    color: '#a1a1aa',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#71717a',
  },
  entriesList: {
    gap: 8,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  entryCardDark: {
    backgroundColor: '#18181b',
  },
  entryColor: {
    width: 4,
    alignSelf: 'stretch',
  },
  entryContent: {
    flex: 1,
    padding: 14,
  },
  entryActivity: {
    fontSize: 15,
    fontWeight: '500',
    color: '#18181b',
    marginBottom: 4,
  },
  entryActivityDark: {
    color: '#fafafa',
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryTime: {
    fontSize: 13,
    color: '#71717a',
  },
  entryTimeDark: {
    color: '#a1a1aa',
  },
  entryDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6366f1',
  },
  entryDurationDark: {
    color: '#818cf8',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
})
