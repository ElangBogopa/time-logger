import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { user, signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    )
  }

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.content}
    >
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Account
        </Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.accountRow}>
            <View style={[styles.avatar, isDark && styles.avatarDark]}>
              <Ionicons name="person" size={24} color={isDark ? '#a1a1aa' : '#71717a'} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountEmail, isDark && styles.accountEmailDark]}>
                {user?.email || 'No email'}
              </Text>
              <Text style={[styles.accountId, isDark && styles.accountIdDark]}>
                ID: {user?.id?.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Preferences
        </Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                Notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#52525b' : '#d4d4d8'} />
          </TouchableOpacity>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="calendar-outline" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                Calendar Integration
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#52525b' : '#d4d4d8'} />
          </TouchableOpacity>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="flag-outline" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                Intentions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#52525b' : '#d4d4d8'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          Support
        </Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                Help & FAQ
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#52525b' : '#d4d4d8'} />
          </TouchableOpacity>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="mail-outline" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                Contact Us
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#52525b' : '#d4d4d8'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutButton, isDark && styles.signOutButtonDark]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={[styles.version, isDark && styles.versionDark]}>
        Time Logger v1.0.0
      </Text>
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
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  sectionTitleDark: {
    color: '#a1a1aa',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: '#18181b',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f4f4f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDark: {
    backgroundColor: '#27272a',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '500',
    color: '#18181b',
  },
  accountEmailDark: {
    color: '#fafafa',
  },
  accountId: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
  accountIdDark: {
    color: '#a1a1aa',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#18181b',
  },
  settingLabelDark: {
    color: '#fafafa',
  },
  divider: {
    height: 1,
    backgroundColor: '#e4e4e7',
    marginLeft: 48,
  },
  dividerDark: {
    backgroundColor: '#27272a',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  signOutButtonDark: {
    backgroundColor: '#1c1917',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 8,
  },
  versionDark: {
    color: '#52525b',
  },
})
