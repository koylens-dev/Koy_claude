import type { Metadata } from 'next'
import { ItemEditor } from './ItemEditor'

export const metadata: Metadata = { title: 'Edit dish' }

export default async function EditItemPage({ params }: PageProps<'/admin/menu/[id]'>) {
  const { id } = await params
  return <ItemEditor id={id} />
}
