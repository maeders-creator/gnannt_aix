# Protected Würth product groups

The authenticated `products` action reads `wuerth_products` using the existing
validated portal session. The visible worksheet of the supplied top-articles
workbook contains 498 unique articles in 16 product groups. Only article number,
description, original product group and original row number were imported.
Hidden source worksheets, historical revenues and quantities were not imported.
The original workbook and imported rows are not committed to this public repo.

The table has RLS and no anon/authenticated grants or policies. The server role
has SELECT only. The response is no-store; no products or prices enter local
storage or service-worker caches. The UI supports group filters and article
search, preserving leading zeros and formatting in article numbers.

Returned OCI prices are matched only to the exact supplier article after
case/whitespace normalization. Customer material numbers are not supplier IDs.
All duplicate lines remain separate with quantity, price basis and currency.
Missing prices remain unknown. Prices are session-local catalog previews, not
verified quotes or orders. No automatic bulk price API or deep link was assumed.
Use article-number copy and the existing catalog to select/return items.

The obsolete explanation card was removed. Product loading works independently
of OCI status and can be retried. Logout/session changes clear products/prices
and cancel stale results. All 77 repository tests and the Vite production build
passed. Live Würth price retrieval requires a real catalog return.
