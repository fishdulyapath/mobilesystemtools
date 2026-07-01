---
name: sml-ubon-system
description: Work on the SML Ubon staff app and Express marketplace backend. Use when editing or analyzing smlstaff-ubon, MarketPlaceWebServiceExpress, or MarketPlaceStandardWeb, especially sales cart, product set/INV save flow, PU purchase, stock balance, basket reset/concurrency, document comparison, and demo PostgreSQL validation.
---

# SML Ubon System

## Purpose

Use this skill to continue work on the Ubon SML staff/frontend and marketplace Express backend without rediscovering the system shape from scratch.

## Repositories

- Portable location: this skill is stored inside `smlstaff-ubon/.codex/skills/sml-ubon-system` so it can move with the frontend repo.
- Staff frontend: `smlstaff-ubon`
  - Vue/Vite app used by staff.
  - Sales UI lives mainly under `src/components/sell`, `src/stores/cart.js`, and `src/services/sellService.js`.
  - Purchase PU UI lives in `src/views/PurchasePUView.vue`.
- Backend: sibling repo `MarketPlaceWebServiceExpress`
  - Express routes live under `src/routes`.
  - Sales document save logic is mainly in `src/routes/pos.js`.
  - Basket/cart persistence is mainly in `src/routes/basket.js` and `src/routes/cart.js`.
  - Product and product-set APIs are mainly in `src/routes/product.js`.
  - Purchase PU save/update is mainly in `src/routes/purchase.js`.
  - Order/sendorder logic is in `src/routes/order.js`.
  - Document/receipt display logic is in `src/routes/document.js`.
- Reference frontend: sibling repo `MarketPlaceStandardWeb`
  - Use as the behavioral reference when staff flow differs from the main system.

## Working Rules

- Inspect the relevant repo before editing. The workspace may already contain uncommitted user changes.
- Use `rg` first for search. Use `apply_patch` for manual edits.
- Do not revert unrelated changes.
- Prefer backend overrides for document persistence rules that must match the main SML system, even if the frontend payload contains different values.
- Treat demo database writes as real writes. Prefer read-only queries unless the user clearly asks to create or mutate demo data.
- The user usually writes in Thai; reply in Thai unless there is a reason not to.

## Current System Knowledge

- Sales save from staff goes through `/service/v1/saveTrans` and `/service/v1/saveTransAndPro` in `pos.js`.
- Sales details are written to `ic_trans_detail`.
- Documents created by the rebranded MobileTools program should store `ic_trans.creator_code = 'mobiletools'`, but the shared backend service must not hard-code that value. The `smlstaff-ubon` frontend now sends `creator_code: 'mobiletools'`; backend routes persist the received `creator_code`. Keep employee fields such as `sale_code`, `emp_code`, `last_editor_code`, logs, and permission checks as the real staff/user code. For PU display/print, use `user_request` as the staff code instead of `creator_code`.
- Product sets use a parent row with `item_type = 3` and a generated `ref_guid`.
- Product-set child rows point to the parent with `set_ref_line = parent.ref_guid`, store `item_code_main`, and keep `price_set_ratio` separate from `ratio`.
- To match the main system, sale detail `ratio` should be stored as `0` for normal items, product-set parent rows, and product-set child rows. Do not use frontend `item.ratio` for persisted sale details.
- Product-set child rows should persist `stand_value = 1`, `divide_value = 1`, and `ratio = 0`.
- Product-set child `sum_amount` should be `child_price * parent_qty * child_qty_per_set`.
- Display/history APIs should hide set child rows from top-level item lists unless explicitly showing children under the parent.
- Product-set stock should be limited by component availability, and reserved quantity must include items reserved through set components.
- The sales cart should allow adding products and continuing the order even when available stock is zero, negative, or less than the cart quantity. Keep stock warnings visible in product detail and cart stock checks, but do not disable quantity selection, add-to-cart, or next-step actions only because stock is insufficient.
- The sales product catalog should show all products and should not send the `isstock` filter or show sold-out badges/dimmed cards. Out-of-stock messaging belongs in product detail/cart checks as a warning only.
- Sold-out pages/reports should not show product-set parent items (`item_type = 3`) because set parents do not hold stock directly. Component items may still appear if their real stock is depleted.
- Sold-out pages use the selected date/range only to find items sold in that sale date range, but compare those items against current real stock. The full sold-out page sends `from_date` and `to_date`; the dashboard card may still send a single `date`. Frontend date helpers must format local calendar dates with `getFullYear()/getMonth()/getDate()` instead of `toISOString()`; DatePicker returns local midnight and `toISOString()` can shift Thai dates to the previous UTC day.
- Cart/basket state is shared through backend rows such as `staff_cart_order` and basket keys like `BASKET-{id}`. Guard against stale async writes after basket reset.
- PU save/update should refresh `ic_inventory.balance_qty` after receiving goods by recomputing from `sml_ic_function_stock_balance_warehouse_location('NOW()', item_code, '', '')`. Include removed old item codes when updating an existing PU.
- PU footer discount should follow the sale menu calculation pattern.
- Print forms loaded from DB `formdesign` are rendered by backend `MarketPlaceWebServiceExpress/src/utils/salePrintRenderer.js`. Keep table header/detail typography fixes in the renderer instead of editing DB form coordinates: table fonts are capped/reduced, text columns can wrap, numeric columns stay nowrap/right-aligned, and table cells are auto-fitted before print.
- Product management reorder fields are stored in `ic_inventory_detail`: `purchase_point` (จุดสั่งซื้อ), `minimum_qty` (สั่งซื้อต่ำสุด), and `maximum_qty` (จุดสั่งซื้อสูงสุด). Staff product manage APIs should join/upsert this table while keeping base product fields in `ic_inventory`.
- The purchase stock reorder menu uses `/service/v1/getPurchaseStockReorderList`. It must not use cached `ic_inventory.balance_qty` or accrued/book quantities. Compute real stock by summing all rows from `sml_ic_function_stock_balance_warehouse_location('NOW()', item_code_list, '', '')`, including negative balances because negative stock is the real stock state. Subtract cart quantity from `staff_cart_order` converted through `ic_unit_use`. The page defaults to showing all products except service/set parent items and sends `only_reorder=1` only when the "show only reached reorder point" toggle is enabled. In all-products mode with non-stock sorting, the backend paginates candidates before stock lookup for performance, so `totalSuggestQty` is the current page suggestion sum; in only-reorder mode it is the filtered total. A row has reached reorder point only when `purchase_point > 0 AND available_qty <= purchase_point`; only those rows should have a positive `suggest_qty`, computed as `max(minimum_qty, maximum_qty - available_qty)` with `minimum_qty` fallback when `maximum_qty` is zero. Normalize numeric API fields to JavaScript numbers before returning so clients do not show long PostgreSQL decimal strings.
- On the purchase stock reorder page, display status should not call negative or zero available stock "normal" when reorder points are unset. Use display-only statuses: reached reorder point, negative stock, out of stock, then normal. Keep `suggest_qty` tied to configured reorder points; do not invent purchase suggestions for items with `purchase_point = 0`.

## Common Validation

- Backend syntax checks:
  - `node --check src/routes/pos.js`
  - `node --check src/routes/product.js`
  - `node --check src/routes/basket.js`
  - `node --check src/routes/document.js`
  - `node --check src/routes/order.js`
  - `node --check src/routes/purchase.js`
- Frontend build:
  - Run `npm run build` in `smlstaff-ubon`.
- For local frontend verification, run the Vite dev server and open the local URL in the in-app browser when obvious.

## References

- Read `references/sales-product-set.md` before changing product-set sale flow.
- Read `references/cart-and-pu.md` before changing basket reset, cart sharing, PU footer discount, or PU stock balance updates.
- Read `references/database-validation.md` before comparing INV documents or querying the demo database.
