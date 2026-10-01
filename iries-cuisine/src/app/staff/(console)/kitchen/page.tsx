import type { Metadata } from 'next'
import { KitchenDisplay } from './KitchenDisplay'

export const metadata: Metadata = { title: 'Kitchen' }

export default function KitchenPage() {
  return <KitchenDisplay />
}
