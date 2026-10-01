import { describe, expect, it } from 'vitest'
import { formatCedis, formatGhsPlain, parseCedisToPesewas } from '../money'
import { formatGhanaPhone, normalizeGhanaPhone, whatsappLink } from '../phone'
import { mapsLink, normalizeGhanaPostGps } from '../ghana-post'
import { toCsv } from '../csv'
import { slugify } from '../slug'

describe('money', () => {
  it('formats pesewas as cedis', () => {
    expect(formatCedis(18550)).toBe('GH₵185.50')
    expect(formatCedis(0)).toBe('GH₵0.00')
    expect(formatCedis(123456789)).toBe('GH₵1,234,567.89')
    expect(formatGhsPlain(18500)).toBe('GHS 185.00')
  })
  it('parses typed amounts', () => {
    expect(parseCedisToPesewas('85')).toBe(8500)
    expect(parseCedisToPesewas('85.5')).toBe(8550)
    expect(parseCedisToPesewas('GH₵ 1,085.50')).toBe(108550)
    expect(parseCedisToPesewas('85.555')).toBeNull()
    expect(parseCedisToPesewas('abc')).toBeNull()
    expect(parseCedisToPesewas('-5')).toBeNull()
  })
})

describe('Ghana phone numbers', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
    ['+233 24 123 4567', '+233241234567'],
    ['233541234567', '+233541234567'],
    ['00233201234567', '+233201234567'],
    ['241234567', '+233241234567'],
  ])('%s -> %s', (input, expected) => expect(normalizeGhanaPhone(input)).toBe(expected))

  it.each(['12345', '0341234567', '+2342412345678', '', '02412345678'])('rejects %s', (input) => {
    expect(normalizeGhanaPhone(input)).toBeNull()
  })

  it('formats for display and WhatsApp', () => {
    expect(formatGhanaPhone('+233241234567')).toBe('024 123 4567')
    expect(whatsappLink('+233241234567', 'Hi there')).toBe('https://wa.me/233241234567?text=Hi%20there')
  })
})

describe('Ghana Post GPS', () => {
  it.each([
    ['GA-543-0125', 'GA-543-0125'],
    ['ga5430125', 'GA-543-0125'],
    ['GA 543 0125', 'GA-543-0125'],
    ['AK-484-9321', 'AK-484-9321'],
    ['GE-1234-5678', 'GE-1234-5678'],
  ])('%s -> %s', (input, expected) => expect(normalizeGhanaPostGps(input)).toBe(expected))

  it('rejects junk', () => {
    expect(normalizeGhanaPostGps('Adenta')).toBeNull()
    expect(normalizeGhanaPostGps('G-543-0125')).toBeNull()
  })

  it('builds map links', () => {
    expect(mapsLink({ lat: 5.7, lng: -0.16 })).toBe('https://www.google.com/maps/search/?api=1&query=5.7,-0.16')
    expect(mapsLink({ gps: 'GA-543-0125', landmark: 'SDA church' })).toContain('GA-543-0125')
    expect(mapsLink({})).toBeNull()
  })
})

describe('csv', () => {
  it('escapes and neutralises spreadsheet formulas', () => {
    const csv = toCsv(['name', 'amount'], [['=HYPERLINK("x")', -5], ['Ama, "Mensah"', '12.50']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('-5')
    expect(csv).toContain('"Ama, ""Mensah"""')
  })
})

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify("Irie's Jollof & Chicken")).toBe('iries-jollof-chicken')
    expect(slugify('Kéléwélé!!')).toBe('kelewele')
  })
})
