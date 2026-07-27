import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { put } from '@vercel/blob'

const MAX_SIZE = 8 * 1024 * 1024 // 8MB, alinhado com /api/documentos/extrair
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * POST /api/upload
 * Body: FormData { file }
 * Upload genérico de imagens (fotos de propriedades) para Vercel Blob.
 * Requer BLOB_READ_WRITE_TOKEN — sem essa variável (Blob Store por criar,
 * ver .env.example), devolve 501 e a UI mantém o campo de URL como alternativa.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Upload de ficheiros ainda não está configurado. Usa um link de imagem por agora.' },
      { status: 501 },
    )
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato não suportado. Usa JPEG, PNG, WEBP ou GIF.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 8MB)' }, { status: 413 })
  }

  const ext = file.type.split('/')[1]
  const pathname = `propriedades/${userId}/${crypto.randomUUID()}.${ext}`

  try {
    const blob = await put(pathname, file, { access: 'public', addRandomSuffix: false })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[upload]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao carregar o ficheiro' }, { status: 500 })
  }
}
