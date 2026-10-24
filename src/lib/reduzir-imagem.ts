/**
 * Reduz uma fotografia no browser antes de a carregar: lado maior até
 * 2400 px, JPEG a 85 %. Uma foto de telemóvel passa de 4–8 MB para algumas
 * centenas de KB — carrega mais depressa em rede móvel, cabe no limite de
 * 8 MB do `/api/upload` e não fica a ocupar armazenamento que pagamos.
 *
 * Se o browser não conseguir ler a imagem, devolve o ficheiro original e
 * quem decide é o servidor.
 */
const LADO_MAXIMO = 2400

export async function reduzirImagem(ficheiro: File): Promise<File> {
  if (ficheiro.type === 'image/gif' || typeof createImageBitmap !== 'function') return ficheiro
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(ficheiro)
  } catch {
    return ficheiro
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); return ficheiro }
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
  if (!blob || (blob.size >= ficheiro.size && escala === 1)) return ficheiro
  const nome = ficheiro.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${nome}.jpg`, { type: 'image/jpeg' })
}
