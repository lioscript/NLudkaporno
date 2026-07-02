---
name: Price updater & images
description: How TON/USD price updates work and where gift images come from
---

# Price updater

**Working endpoint**: `https://fragment.com/stars/buy` with `X-Requested-With: XMLHttpRequest` header returns JSON `{"s": {"tonRate": 1.64}}` — TON/USD rate.
**Fallback**: `https://tonapi.io/v2/rates?tokens=ton&currencies=usd` → `rates.TON.prices.USD`

**Why**: Getgems GraphQL fully blocks server-side requests (GRAPHQL_NO_SCRAPPERS). Fragment HTML pages 403 via CloudFront. Fragment `/stars/buy` with XHR header is the reliable data source.

**How to apply**: `src/priceUpdater.ts` stores base rate in `price_config.json`. Daily at 00:05 UTC it fetches new rate and adjusts all gift prices proportionally (`newPrice = oldPrice × newRate / baseRate`). Bot command `/prices` triggers manually. Admin API: `POST /api/admin/update-prices` with `x-admin-token` header.

**Stars/USD rate used**: $0.013/star (Fragment bulk rate). Not fetched dynamically — hardcoded.

# Gift images

107 PNG images in `public/images/` were originally 200×200 RGB (with backgrounds). All processed to RGBA with transparent backgrounds using Replit's remove_image_background_tool.

**Why**: Getgems/Fragment block all server-side image requests. Telegram Bot API `getAvailableGifts` only returns 11 basic gifts, not the 107 NFT collectible gifts.
