# StockPilot AIx Pharma V5.8 Layout & Import Fix

Fixes:
- KPI cards scale flexibly; stock value should no longer be cut off.
- CSV upload now shows import status and processes directly after selecting file.
- Machines no longer stay in split view after selection: machine list -> select -> linked spare parts only.
- Original logo attempt: fallback SVG/text logo.
- Same Supabase V5 tables, no migration required.

Deploy:
1. Replace GitHub files completely.
2. Vercel -> Redeploy without build cache.
3. Hard refresh / private tab on iPad.
