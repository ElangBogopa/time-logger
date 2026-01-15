import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { TimeEntry, CATEGORY_COLORS, TimeCategory, getLocalDateString } from '@/lib/types'
import { formatDuration } from '@/lib/time-utils'

export default function StatsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { user } = useAuth()

  const [weeklyStats, setWeeklyStats] = useState<{
    totalMinutes: number
    byCategory: Record<TimeCategory, number>
    dailyTotals: number[]
  }>({
    totalMinutes: 0,
    byCategory: {} as Record<TimeCategory, number>,
    dailyTotals: [],
  })
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!user) return

    // Get entries for last 7 days
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)

    const startDate = getLocalDateString(weekAgo)
    const endDate = getLocalDateString(today)

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('date', startDate)
      .lte('date', endDate)

    if (error || !data) return

    const entries = data as TimeEntry[]

    // Calculate totals
    let totalMinutes = 0
    const byCategory: Record<string, number> = {}
    const dailyMap: Record<string, number> = {}

    entries.forEach(entry => {
      totalMinutes += entry.duration_minutes

      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.duration_minutes
      }

      dailyMap[entry.date] = (dailyMap[entry.date] || 0) + entry.duration_minutes
    })

    // Build daily totals array for last 7 days
    const dailyTotals: number[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = getLocalDateString(date)
      dailyTotals.push(dailyMap[dateStr] || 0)
    }

    setWeeklyStats({
      totalMinutes,
      byCategory: byCategory as Record<TimeCategory, number>,
      dailyTotals,
    })
  }, [user])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchStats()
    setRefreshing(false)
  }, [fetchStats])

  // Sort categories by time spent
  const sortedCategories = Object.entries(weeklyStats.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Max for bar chart scaling
  const maxDaily = Math.max(...weeklyStats.dailyTotals, 1)

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Weekly Summary */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
          This Week
        </Text>
        <Text style={[styles.bigNumber, isDark && styles.bigNumberDark]}>
          {formatDuration(weeklyStats.totalMinutes)}
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Total time logged
        </Text>
      </View>

      {/* Daily Bar Chart */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
          Daily Activity
        </Text>
        <View style={styles.barChart}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
            const height = (weeklyStats.dailyTotals[i] / maxDaily) * 100
            const dayIndex = (new Date().getDay() - 6 + i + 7) % 7
            const isToday = i === 6

            return (
              <View key={i} style={styles.barColumn}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: isToday ? '#6366f1' : isDark ? '#52525b' : '#d4d4d8',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isDark && styles.barLabelDark, isToday && styles.barLabelToday]}>
                  {day}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Top Categories */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
          Top Categories
        </Text>
        {sortedCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={32} color={isDark ? '#52525b' : '#d4d4d8'} />
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              No data yet
            </Text>
          </View>
        ) : (
          <View style={styles.categoryList}>
            {sortedCategories.map(([category, minutes]) => {
              const config = CATEGORY_COLORS[category as TimeCategory]
              const percentage = Math.round((minutes / weeklyStats.totalMinutes) * 100)

              return (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <View
                      style={[styles.categoryDot, { backgroundColor: config?.color || '#71717a' }]}
                    />
                    <Text style={[styles.categoryName, isDark && styles.categoryNameDark]}>
                      {config?.label || category}
                    </Text>
                  </View>
                  <View style={styles.categoryStats}>
                    <Text style={[styles.categoryTime, isDark && styles.categoryTimeDark]}>
                      {formatDuration(minutes)}
                    </Text>
                    <Text style={[styles.categoryPercent, isDark && styles.categoryPercentDark]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </ScrollView>
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
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: '#18181b',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitleDark: {
    color: '#a1a1aa',
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#18181b',
  },
  bigNumberDark: {
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 4,
  },
  subtitleDark: {
    color: '#a1a1aa',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginTop: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 8,
  },
  barLabelDark: {
    color: '#a1a1aa',
  },
  barLabelToday: {
    color: '#6366f1',
    fontWeight: '600',
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 15,
    color: '#18181b',
  },
  categoryNameDark: {
    color: '#fafafa',
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  categoryTimeDark: {
    color: '#fafafa',
  },
  categoryPercent: {
    fontSize: 12,
    color: '#71717a',
    minWidth: 36,
    textAlign: 'right',
  },
  categoryPercentDark: {
    color: '#a1a1aa',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#71717a',
  },
  emptyTextDark: {
    color: '#a1a1aa',
  },
})
