import type { Metadata } from 'next'
import { ModifiersAdmin } from './ModifiersAdmin'

export const metadata: Metadata = { title: 'Extras & spice' }

export default function ModifiersPage() {
  return <ModifiersAdmin />
}
