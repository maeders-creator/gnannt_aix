import {safeProductImageUrl} from './integrations/wuerthOci.mjs'
// Supplier numbers only: customer material numbers are not reliable product IDs.
export const normalizeArticle = value => String(value ?? '').replace(/\s/g, '').toUpperCase()
export function matchingPrices(product, items = []) {
  const article = normalizeArticle(product.article_number)
  return article ? (Array.isArray(items) ? items : []).filter(item => normalizeArticle(item.supplierArticle) === article) : []
}
export function hasPrice(item) {
  return (typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0) ||
    (typeof item.price === 'string' && /^\d+(?:[.,]\d+)?$/.test(item.price.trim()))
}
export function priceLabel(item) {
  if (!hasPrice(item)) return 'Noch kein OCI-Preis'
  return `${item.price} ${item.currency || '(Währung unbekannt)'} je ${item.priceUnit || '(Preiseinheit unbekannt)'} ${item.unit || '(Einheit unbekannt)'}`
}
export function groupProducts(products, query = '', selected = '') {
  const search = query.trim().toLocaleLowerCase('de')
  const compact = normalizeArticle(query)
  const groups = new Map()
  for (const product of products) {
    const group = product.product_group || 'Ohne Produktgruppe'
    if (selected && selected !== group) continue
    if (search && !`${product.description} ${group}`.toLocaleLowerCase('de').includes(search) && !normalizeArticle(product.article_number).includes(compact)) continue
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(product)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'de'))
}

// The newest live selection wins only for products actually present in it.
export function productItems(product, liveItems) {
  const live = matchingPrices(product, liveItems)
  return live.length ? live : matchingPrices(product, product.catalog?.items)
}
export function productImage(items = []) {
  for (const item of items) {
    const url = safeProductImageUrl(item.imageUrl)
    if (url) return {url, status: 'available'}
  }
  return {url: null, status: items.some(item => item.imageStatus === 'unsupported' || item.imageUrl) ? 'unsupported' : 'not_supplied'}
}
export function catalogCoverage(products, liveItems) {
  return products.reduce((counts, product) => {
    const items = productItems(product, liveItems)
    if (items.some(hasPrice)) counts.prices++
    if (productImage(items).url) counts.images++
    return counts
  }, {prices: 0, images: 0})
}
export function importDateLabel(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('de-DE', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Berlin'}).format(date)
}
