import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { formatDuration, formatTimeDisplay, timeToMinutes } from '@/lib/time-utils'
import QuickLogModal from '@/components/QuickLogModal'

// Helper functions matching web app
function formatDateDisplay(dateStr: string): { label: string; date: string; isFuture: boolean } {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isFuture = date > today

  if (dateStr === getLocalDateString(today)) {
    return { label: 'Today', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(yesterday)) {
    return { label: 'Yesterday', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(tomorrow)) {
    return { label: 'Tomorrow', date: formattedDate, isFuture: true }
  }

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return { label: weekday, date: formattedDate, isFuture }
}

function getAdjacentDate(dateStr: string, direction: 'prev' | 'next'): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
  return getLocalDateString(date)
}

function getTimeOfDayGreeting(): { greeting: string; prompt: string } {
  const hour = new Date().getHours()

  if (hour < 12) {
    return {
      greeting: 'Good morning',
      prompt: "Log your morning when you're ready.",
    }
  } else if (hour < 18) {
    return {
      greeting: 'Good afternoon',
      prompt: "How's the day going?",
    }
  } else {
    return {
      greeting: 'Good evening',
      prompt: 'Wind down time. How was today?',
    }
  }
}

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { user } = useAuth()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)

  const today = getLocalDateString()
  const isToday = selectedDate === today

  const { dateDisplay, isFutureDay, isPastDay } = useMemo(() => {
    const display = formatDateDisplay(selectedDate)
    return {
      dateDisplay: display,
      isFutureDay: display.isFuture,
      isPastDay: !isToday && !display.isFuture
    }
  }, [selectedDate, isToday])

  const greeting = useMemo(() => getTimeOfDayGreeting(), [])

  const fetchEntries = useCallback(async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', selectedDate)
      .order('start_time', { ascending: true })

    if (!error && data) {
      setEntries(data as TimeEntry[])
    }
    setIsLoading(false)
  }, [user, selectedDate])

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

  const lastEntryEndTime = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((latest, entry) => {
      if (!entry.end_time) return latest
      if (!latest) return entry.end_time
      return entry.end_time > latest ? entry.end_time : latest
    }, null as string | null)
  }, [entries])

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          Time Logger
        </Text>
        <TouchableOpacity
          style={[
            styles.quickLogButton,
            isFutureDay && styles.quickLogButtonFuture,
            isPastDay && styles.quickLogButtonPast,
          ]}
          onPress={() => setIsQuickLogOpen(true)}
        >
          <Ionicons
            name={isFutureDay ? 'calendar' : isPastDay ? 'add' : 'flash'}
            size={18}
            color="#ffffff"
          />
          <Text style={styles.quickLogButtonText}>
            {isFutureDay ? 'Plan' : isPastDay ? 'Add' : 'Quick Log'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Navigation */}
      <View style={[styles.dateNav, isDark && styles.dateNavDark]}>
        <TouchableOpacity
          style={styles.dateNavButton}
          onPress={() => setSelectedDate(getAdjacentDate(selectedDate, 'prev'))}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? '#a1a1aa' : '#71717a'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setSelectedDate(today)}
        >
          <Text style={[styles.dateLabel, isDark && styles.dateLabelDark]}>
            {dateDisplay.label}
          </Text>
          <Text style={[styles.dateValue, isDark && styles.dateValueDark]}>
            {dateDisplay.date}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateNavButton}
          onPress={() => setSelectedDate(getAdjacentDate(selectedDate, 'next'))}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={isDark ? '#a1a1aa' : '#71717a'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Greeting - only for today */}
        {isToday && (
          <View style={styles.greetingContainer}>
            <Text style={[styles.greetingText, isDark && styles.greetingTextDark]}>
              {greeting.greeting}! {greeting.prompt}
            </Text>
          </View>
        )}

        {/* Stats Card */}
        <View style={[styles.statsCard, isDark && styles.statsCardDark]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>
              {formatDuration(totalMinutes)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Logged {isToday ? 'today' : dateDisplay.label.toLowerCase()}
            </Text>
          </View>
          <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>
              {entries.length}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Activities
            </Text>
          </View>
        </View>

        {/* Entries List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {isToday ? "Today's Activities" : `Activities for ${dateDisplay.label}`}
          </Text>

          {entries.length === 0 ? (
            <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={isDark ? '#52525b' : '#d4d4d8'}
              />
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                No activities logged
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
                      {entry.commentary && (
                        <Text style={[styles.entryCommentary, isDark && styles.entryCommentaryDark]} numberOfLines={2}>
                          {entry.commentary}
                        </Text>
                      )}
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

      {/* Quick Log Modal */}
      {user && (
        <QuickLogModal
          visible={isQuickLogOpen}
          onClose={() => setIsQuickLogOpen(false)}
          onEntryAdded={() => {
            setIsQuickLogOpen(false)
            fetchEntries()
          }}
          userId={user.id}
          lastEntryEndTime={lastEntryEndTime}
        />
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  headerDark: {
    borderBottomColor: '#27272a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181b',
  },
  headerTitleDark: {
    color: '#fafafa',
  },
  quickLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  quickLogButtonFuture: {
    backgroundColor: '#6366f1',
  },
  quickLogButtonPast: {
    backgroundColor: '#71717a',
  },
  quickLogButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  dateNavDark: {
    borderBottomColor: '#27272a',
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181b',
  },
  dateLabelDark: {
    color: '#fafafa',
  },
  dateValue: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 2,
  },
  dateValueDark: {
    color: '#a1a1aa',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  greetingContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  greetingText: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
  },
  greetingTextDark: {
    color: '#a1a1aa',
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
  statDividerDark: {
    backgroundColor: '#27272a',
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
  entryCommentary: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 6,
    fontStyle: 'italic',
  },
  entryCommentaryDark: {
    color: '#71717a',
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
