# Private Würth products and OCI enrichment

The authenticated `products` action reads 498 articles in 16 groups from the
supplied top-articles workbook. Only visible source rows were imported. The
workbook, customer prices and imported rows are not in this public repository.

## Actual OCI return required

OCI is a selected-item return, not an automatic whole-catalog API. The initial
live inspection found no returned carts and no product prices or images. A user
must open the catalog from the portal, select articles and return the selection
using the supplier's transfer-to-portal action. Do not place an order. The
callback imports only actual returned items whose supplier article matches an
existing product after whitespace/case normalization. Customer material numbers
and approximate matches are never used.

The service-only `wuerth_product_catalog` table stores the most recent returned
selection per matched article, including every duplicate line, original decimal
price, quantity, price unit, currency and import timestamp. Missing prices remain
unknown and zero stays zero. A later return replaces that article's prior
snapshot, including missing values, so stale data is not presented as current.
The new snapshot and one-use callback acceptance are atomic. Replayed, expired
or invalid callbacks cannot change existing product data. Reference product rows
remain read-only to the service role. All catalog tables have RLS, no public
policies and no anon/authenticated grants. Portal-session validation is required
for reads. Snapshots are company catalog previews, not verified supplier quotes.

## Optional images

Supported fields are standard `NEW_ITEM-ATTACHMENT` (excluding configuration
attachments) and optional `IMAGE`, `IMAGE_URL`, `EXT_IMAGE_URL` extensions. The
actual fields emitted by this Würth account still require a real return to verify.
Only absolute HTTPS raster URLs on the exact approved hosts eshop.wuerth.de,
media.wuerth.com, www.wuerth.de and media.witglobal.net are retained. These hosts
were observed on the public Würth shop. Credentials, ports, queries, fragments,
SVG/HTML/documents, external hosts and encoded path delimiters are rejected.
Unsupported images do not prevent valid price imports. No image URLs are guessed
from article numbers and no remote URLs are fetched by the backend. Images are
rendered lazily with no referrer; missing, rejected and failed images have clear
fallbacks. The coverage display counts accepted image URLs, not successful loads.

SAP attachment-field reference:
https://help.sap.com/docs/SUPPORT_CONTENT/srm/3362936504.html

The callback URL automatically retrieves the returned preview and reloads stored
products. Returning focus also refreshes a pending selection; manual refresh is
available. Logout and session changes cancel stale results and clear memory.
Products and prices do not enter localStorage or service-worker caches.

## Verification

Run `node --test tests/*.test.mjs` and `npm run build`.
`tests/wuerth-catalog-transaction.sql` tests actual database RPC behavior inside a
transaction and rolls back all synthetic rows. It covers exact article matching,
duplicates, zero/decimal price preservation, images, replay/expiry and service-role
access. No synthetic product data is retained in production.
