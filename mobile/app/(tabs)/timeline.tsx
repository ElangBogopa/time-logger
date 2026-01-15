import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Dimensions,
  RefreshControl,
} from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { TimeEntry, CATEGORY_COLORS, getLocalDateString } from '@/lib/types'
import { timeToMinutes, formatHour } from '@/lib/time-utils'

const HOUR_HEIGHT = 60
const TIMELINE_HEIGHT = 24 * HOUR_HEIGHT
const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function TimelineScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { user } = useAuth()
  const scrollViewRef = useRef<ScrollView>(null)

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

  // Scroll to current time on mount
  useEffect(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const scrollY = Math.max(0, (currentHour - 2) * HOUR_HEIGHT)

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: scrollY, animated: false })
    }, 100)
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEntries()
    setRefreshing(false)
  }, [fetchEntries])

  // Current time indicator
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentTimeTop = (currentMinutes / (24 * 60)) * TIMELINE_HEIGHT

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.timelineContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hour labels and grid lines */}
        {Array.from({ length: 24 }).map((_, hour) => (
          <View key={hour} style={[styles.hourRow, { top: hour * HOUR_HEIGHT }]}>
            <Text style={[styles.hourLabel, isDark && styles.hourLabelDark]}>
              {formatHour(hour)}
            </Text>
            <View style={[styles.hourLine, isDark && styles.hourLineDark]} />
          </View>
        ))}

        {/* Time entries */}
        {entries.map(entry => {
          if (!entry.start_time || !entry.end_time) return null

          const startMins = timeToMinutes(entry.start_time)
          const endMins = timeToMinutes(entry.end_time)
          const duration = endMins - startMins

          const top = (startMins / (24 * 60)) * TIMELINE_HEIGHT
          const height = (duration / (24 * 60)) * TIMELINE_HEIGHT

          const categoryConfig = entry.category ? CATEGORY_COLORS[entry.category] : null
          const bgColor = isDark
            ? categoryConfig?.darkBgColor || '#27272a'
            : categoryConfig?.bgColor || '#f4f4f5'
          const borderColor = categoryConfig?.color || '#71717a'

          return (
            <View
              key={entry.id}
              style={[
                styles.entryBlock,
                {
                  top,
                  height: Math.max(height, 20),
                  backgroundColor: bgColor,
                  borderLeftColor: borderColor,
                },
                entry.status === 'pending' && styles.entryBlockPending,
              ]}
            >
              <Text
                style={[styles.entryText, isDark && styles.entryTextDark]}
                numberOfLines={height < 40 ? 1 : 2}
              >
                {entry.activity}
              </Text>
            </View>
          )
        })}

        {/* Current time indicator */}
        <View style={[styles.currentTime, { top: currentTimeTop }]}>
          <View style={styles.currentTimeDot} />
          <View style={styles.currentTimeLine} />
        </View>
      </ScrollView>
    </View>
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
  timelineContainer: {
    height: TIMELINE_HEIGHT,
    paddingLeft: 56,
    paddingRight: 8,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: HOUR_HEIGHT,
  },
  hourLabel: {
    width: 48,
    fontSize: 11,
    color: '#71717a',
    textAlign: 'right',
    paddingRight: 8,
    marginTop: -6,
  },
  hourLabelDark: {
    color: '#52525b',
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e4e4e7',
  },
  hourLineDark: {
    backgroundColor: '#27272a',
  },
  entryBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 8,
    overflow: 'hidden',
  },
  entryBlockPending: {
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  entryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#18181b',
  },
  entryTextDark: {
    color: '#fafafa',
  },
  currentTime: {
    position: 'absolute',
    left: 48,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  currentTimeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: -5,
  },
  currentTimeLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ef4444',
  },
})
