'use client'

import { useState, useRef } from 'react'
import { Camera, FileText, ExternalLink, RotateCcw, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ExtractedData = Record<string, string>

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome completo',
  data_nascimento: 'Data de nascimento',
  nacionalidade: 'Nacionalidade',
  numero_documento: 'Nº documento',
  tipo_documento: 'Tipo de documento',
  data_validade: 'Validade',
  sexo: 'Sexo',
  pais_emissao: 'País de emissão',
}

function formatForSIBA(data: ExtractedData): string {
  return Object.entries(FIELD_LABELS)
    .filter(([key]) => data[key])
    .map(([key, label]) => `${label}: ${data[key]}`)
    .join('\n')
}

export default function DocumentosPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [data, setData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setData(null)
    setError('')
    setPreview(URL.createObjectURL(file))
    extractData(file)
  }

  async function extractData(file: File) {
    setExtracting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/documentos/extrair', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
    } catch {
      setError('Não foi possível extrair os dados. Tenta com uma foto mais nítida.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleCopyAll() {
    if (!data) return
    await navigator.clipboard.writeText(formatForSIBA(data))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setPreview(null)
    setData(null)
    setError('')
    setCopied(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-4 border-2 border-dashed border-border rounded-2xl py-14 px-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors active:bg-primary/10"
          >
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Camera className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Fotografar documento</p>
              <p className="text-sm text-muted-foreground">
                Passaporte, Cartão de Cidadão ou BI
              </p>
            </div>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Documento"
                className="w-full rounded-xl object-cover max-h-52"
              />
            </div>
            <button
              type="button"
              onClick={reset}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Trocar documento
            </button>
          </div>
        )}

        {extracting && (
          <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 animate-pulse text-primary shrink-0" />
            A extrair dados do documento...
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {data && !extracting && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Dados extraídos
              </h2>
              <button
                type="button"
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied
                  ? <><Check className="h-3.5 w-3.5 text-primary" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5" /> Copiar tudo</>
                }
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {Object.entries(data).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between px-4 py-3 gap-4"
                >
                  <span className="text-xs text-muted-foreground shrink-0 pt-0.5 w-32">
                    {FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-right break-all">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <a
              href="https://siba.sef.pt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm font-medium text-primary py-2"
            >
              Abrir portal SIBA
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
