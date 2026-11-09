// Supplier numbers only: customer material numbers are not reliable product IDs.
export const normalizeArticle = value => String(value ?? '').replace(/\s/g, '').toUpperCase()
export function matchingPrices(product, items = []) {
  const article = normalizeArticle(product.article_number)
  return article ? items.filter(item => normalizeArticle(item.supplierArticle) === article) : []
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
