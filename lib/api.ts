// lib/api.ts
import { Platform } from 'react-native'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || ''

export async function apiCall(
  route: string,
  body: Record<string, any> = {},
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (Platform.OS !== 'web') {
    headers['x-api-key'] = process.env.EXPO_PUBLIC_API_KEY || ''
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}/${route}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || `Erreur ${response.status}`)
  }

  return data
}
