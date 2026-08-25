export function otimizarImagem(url, largura = 400) {
  if (!url || !url.includes('cloudinary')) return url
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${largura}/`)
}