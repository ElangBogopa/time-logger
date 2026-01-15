import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  SafeAreaView,
  Platform,
} from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'

// Required for web OAuth
WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        })

        if (error) throw error
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message || 'Sign in failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'timelogger',
        path: 'auth/callback',
      })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      })

      if (error) throw error

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        )

        if (result.type === 'success') {
          const url = result.url
          // Extract the access token and refresh token from the URL
          const params = new URLSearchParams(url.split('#')[1])
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        {/* Logo / Title */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
            <Ionicons name="time-outline" size={48} color={isDark ? '#818cf8' : '#6366f1'} />
          </View>
          <Text style={[styles.title, isDark && styles.titleDark]}>Time Logger</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Track your time with intention
          </Text>
        </View>

        {/* Auth Section */}
        <View style={styles.authSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Google Sign In - works on all platforms */}
          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#18181b" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#18181b" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign In - only on iOS native */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}
        </View>

        {/* Footer */}
        <Text style={[styles.footer, isDark && styles.footerDark]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainerDark: {
    backgroundColor: '#1e1b4b',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 8,
  },
  titleDark: {
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 16,
    color: '#71717a',
  },
  subtitleDark: {
    color: '#a1a1aa',
  },
  authSection: {
    gap: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  googleButtonText: {
    color: '#18181b',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  footer: {
    marginTop: 48,
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerDark: {
    color: '#71717a',
  },
})
