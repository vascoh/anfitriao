import { describe, it, expect } from 'vitest'
import { sibaComplete, STATUS_LABEL, SOURCE_LABEL, TAG_LABEL, PROPERTY_TYPE_LABEL } from './labels'

describe('sibaComplete', () => {
  const base = {
    numero_documento: 'AB123456',
    data_nascimento: '1990-01-01',
    tipo_documento: 'passaporte',
    sexo: 'M',
    pais_emissao: 'PT',
  }

  it('is complete with all fields', () => {
    expect(sibaComplete(base)).toBe(true)
  })

  it('requires document number, birth date and document type', () => {
    expect(sibaComplete({ ...base, numero_documento: undefined })).toBe(false)
    expect(sibaComplete({ ...base, data_nascimento: undefined })).toBe(false)
    expect(sibaComplete({ ...base, tipo_documento: undefined })).toBe(false)
  })

  it('accepts either sexo or pais_emissao', () => {
    expect(sibaComplete({ ...base, sexo: undefined })).toBe(true)
    expect(sibaComplete({ ...base, pais_emissao: undefined })).toBe(true)
    expect(sibaComplete({ ...base, sexo: undefined, pais_emissao: undefined })).toBe(false)
  })
})

describe('label maps', () => {
  it('covers every booking status', () => {
    for (const s of ['pendente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'no_show'] as const) {
      expect(STATUS_LABEL[s]).toBeTruthy()
    }
  })

  it('covers every booking source', () => {
    for (const s of ['airbnb', 'booking', 'direto', 'expedia', 'vrbo', 'outro'] as const) {
      expect(SOURCE_LABEL[s]).toBeTruthy()
    }
  })

  it('covers every guest tag and property type', () => {
    for (const t of ['vip', 'frequente', 'novo', 'problematico'] as const) {
      expect(TAG_LABEL[t]).toBeTruthy()
    }
    for (const p of ['apartamento', 'moradia', 'quarto', 'outro'] as const) {
      expect(PROPERTY_TYPE_LABEL[p]).toBeTruthy()
    }
  })
})
