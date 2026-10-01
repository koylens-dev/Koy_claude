import type { Metadata } from 'next'
import { SalesDashboard } from './SalesDashboard'

export const metadata: Metadata = { title: 'Sales' }

export default function AdminHome() {
  return <SalesDashboard />
}
