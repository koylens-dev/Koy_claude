import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { getStaffMember } from '@/lib/server/auth'
import type { OrderWithItems } from '@/lib/types'
import { formatCedis } from '@/lib/money'
import { formatDateTime, formatSlot } from '@/lib/time'
import { formatGhanaPhone } from '@/lib/phone'
import { AutoPrint } from './AutoPrint'

export const metadata: Metadata = { title: 'Ticket', robots: { index: false } }

// 80 mm kitchen/bagging ticket. Works with any thermal printer installed as a normal
// printer (USB/Bluetooth/network) — the browser's print dialog does the rest.
export default async function TicketPage({ params }: PageProps<'/staff/ticket/[id]'>) {
  const staff = await getStaffMember()
  if (!staff) redirect('/staff/login')
  const { id } = await params
  const supabase = await getServerSupabase()
  const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle()
  if (!data) notFound()
  const o = data as OrderWithItems

  return (
    <main className="print-ticket mx-auto w-[76mm] bg-white p-2 font-mono text-[12px] leading-snug text-black">
      <AutoPrint />
      <p className="text-center text-[11px]">IRIE&apos;S CUISINE</p>
      {o.is_demo && <p className="my-1 border-2 border-black text-center text-[14px] font-bold">PRACTICE: DO NOT COOK</p>}
      <p className="text-center text-[28px] font-bold leading-none">#{o.order_number}</p>
      <p className="mt-1 text-center text-[14px] font-bold uppercase">{o.fulfilment === 'delivery' ? `Delivery · ${o.zone_name ?? ''}` : 'Pickup'}</p>
      {o.scheduled_for && <p className="text-center font-bold">SCHEDULED {formatSlot(o.scheduled_for).toUpperCase()}</p>}
      <p className="text-center text-[11px]">{formatDateTime(o.paid_at ?? o.created_at)}</p>
      <hr className="my-2 border-dashed border-black" />
      <ul className="space-y-1.5">
        {o.order_items.map((i) => (
          <li key={i.id}>
            <p className="text-[14px] font-bold">
              {i.quantity} x {i.item_name}
            </p>
            {i.portion_name && <p className="pl-3">{i.portion_name}</p>}
            {i.modifiers.map((m, idx) => (
              <p key={idx} className="pl-3">+ {m.option}</p>
            ))}
            {i.notes && <p className="pl-3 font-bold">!! {i.notes}</p>}
          </li>
        ))}
      </ul>
      {o.notes && (
        <>
          <hr className="my-2 border-dashed border-black" />
          <p className="font-bold">NOTE: {o.notes}</p>
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <p>{o.customer_name}</p>
      <p>{formatGhanaPhone(o.customer_phone)}</p>
      {o.fulfilment === 'delivery' && (
        <>
          {o.address_landmark && <p>{o.address_landmark}</p>}
          {o.address_gps && <p>{o.address_gps}</p>}
          {o.address_directions && <p>{o.address_directions}</p>}
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <p className="flex justify-between font-bold">
        <span>TOTAL (PAID)</span>
        <span>{formatCedis(o.total_pesewas)}</span>
      </p>
    </main>
  )
}
