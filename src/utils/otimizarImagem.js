// limitar = true adiciona c_limit: a imagem só é reduzida, nunca ampliada.
// Chamadas antigas (sem o 3º parâmetro) geram exatamente a mesma URL de antes,
// então não criam transformações novas no Cloudinary.
export function otimizarImagem(url, largura = 400, limitar = false) {
  if (!url || !url.includes('cloudinary')) return url
  const crop = limitar ? 'c_limit,' : ''
  return url.replace('/upload/', `/upload/f_auto,q_auto,${crop}w_${largura}/`)
}