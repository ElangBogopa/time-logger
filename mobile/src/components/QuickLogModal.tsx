import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/types'
import { formatDuration, timeToMinutes, getCurrentTime } from '@/lib/time-utils'

interface QuickLogModalProps {
  visible: boolean
  onClose: () => void
  onEntryAdded: () => void
  userId: string
  lastEntryEndTime: string | null
}

export default function QuickLogModal({
  visible,
  onClose,
  onEntryAdded,
  userId,
  lastEntryEndTime,
}: QuickLogModalProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const [activity, setActivity] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setActivity('')
      setNotes('')
      setError(null)
      setEndTime(getCurrentTime())
      setStartTime(lastEntryEndTime || '')
    }
  }, [visible, lastEntryEndTime])

  // Calculate duration
  const duration = useCallback(() => {
    if (!startTime || !endTime) return 0
    const startMins = timeToMinutes(startTime)
    const endMins = timeToMinutes(endTime)
    return Math.max(0, endMins - startMins)
  }, [startTime, endTime])

  const handleSubmit = async () => {
    if (!activity.trim()) {
      setError('Please describe what you just finished')
      return
    }

    const dur = duration()
    if (dur <= 0) {
      setError('Please set a valid start time')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const today = getLocalDateString()

      // Insert entry without AI categorization (will be null)
      // Category can be updated later or via web app
      const newEntry = {
        user_id: userId,
        date: today,
        activity,
        category: null, // AI categorization not available on mobile yet
        duration_minutes: dur,
        start_time: startTime,
        end_time: endTime,
        description: notes || null,
        status: 'confirmed',
      }

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert(newEntry)

      if (insertError) {
        throw new Error(insertError.message)
      }

      onEntryAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Time input formatter (HH:MM)
  const formatTimeInput = (text: string): string => {
    const digits = text.replace(/\D/g, '')
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
  }

  const dur = duration()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, isDark && styles.containerDark]}
      >
        {/* Header */}
        <View style={[styles.header, isDark && styles.headerDark]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={24}
              color={isDark ? '#fafafa' : '#18181b'}
            />
          </TouchableOpacity>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            Quick Log
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Activity Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>
              What did you just finish?
            </Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={activity}
              onChangeText={setActivity}
              placeholder="e.g., Deep work on project X"
              placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
              autoFocus
            />
          </View>

          {/* Time Inputs */}
          <View style={styles.timeRow}>
            <View style={styles.timeInputGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                Start
              </Text>
              <TextInput
                style={[styles.timeInput, isDark && styles.inputDark]}
                value={startTime}
                onChangeText={(text) => setStartTime(formatTimeInput(text))}
                placeholder="09:00"
                placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={styles.timeSeparator}>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={isDark ? '#52525b' : '#a1a1aa'}
              />
            </View>
            <View style={styles.timeInputGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                End
              </Text>
              <TextInput
                style={[styles.timeInput, isDark && styles.inputDark]}
                value={endTime}
                onChangeText={(text) => setEndTime(formatTimeInput(text))}
                placeholder="10:00"
                placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>

          {/* Duration Display */}
          {dur > 0 && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={16} color="#6366f1" />
              <Text style={styles.durationText}>{formatDuration(dur)}</Text>
            </View>
          )}

          {/* Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>
              Notes (optional)
            </Text>
            <TextInput
              style={[styles.input, styles.notesInput, isDark && styles.inputDark]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any quick details..."
              placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || !activity.trim() || dur <= 0) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || !activity.trim() || dur <= 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>Log it</Text>
                <Ionicons name="flash" size={20} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#18181b',
  },
  titleDark: {
    color: '#fafafa',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#52525b',
    marginBottom: 8,
  },
  labelDark: {
    color: '#a1a1aa',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#18181b',
  },
  inputDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    color: '#fafafa',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    color: '#18181b',
  },
  timeSeparator: {
    paddingBottom: 14,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})
