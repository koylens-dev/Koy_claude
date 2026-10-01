import type { Metadata } from 'next'
import { MenuAdmin } from './MenuAdmin'

export const metadata: Metadata = { title: 'Menu' }

export default function AdminMenuPage() {
  return <MenuAdmin />
}
