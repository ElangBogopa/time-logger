import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'

export default function Index() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  if (user) {
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/login" />
}
