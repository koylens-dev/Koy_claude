import type { Metadata } from 'next'
import { SettingsAdmin } from './SettingsAdmin'

export const metadata: Metadata = { title: 'Hours & settings' }

export default function SettingsPage() {
  return <SettingsAdmin />
}
