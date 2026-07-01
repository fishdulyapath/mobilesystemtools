# Sales Product Set Flow

## Frontend

- Main staff files:
  - `smlstaff-ubon/src/stores/cart.js`
  - `smlstaff-ubon/src/services/sellService.js`
  - `smlstaff-ubon/src/components/sell/ProductCatalogStep.vue`
  - `smlstaff-ubon/src/components/sell/ProductDetailSheet.vue`
  - `smlstaff-ubon/src/components/sell/CartItemsStep.vue`
  - `smlstaff-ubon/src/components/sell/CartPriceCheckStep.vue`
  - `smlstaff-ubon/src/components/sell/CartPaymentStep.vue`
- Staff should detect product sets with `item_type === '3'`.
- Product sets use `/getProductSetDetail` for pricing and `/getProductSetItem` for components.
- Cart items for sets should carry `sub_item` into the payment payload.
- Cart display should show a set badge and child lines, with child display qty equal to `child.qty * parent.qty`.
- Before saving payment, hydrate missing `sub_item` rows so backend can persist complete set details.

## Backend

- `MarketPlaceWebServiceExpress/src/routes/pos.js`
  - `handleSaveTrans` writes sale headers and detail rows.
  - `getSetSubItemsForSale` is the fallback if frontend omits `sub_item`.
  - Use `line_number`/`roworder` from `ic_inventory_set_detail` when ordering children.
- `MarketPlaceWebServiceExpress/src/routes/product.js`
  - `getProductList` should report set stock as the minimum available component stock.
  - `getProductSetItem` should return `line_number` and `roworder`.
- `MarketPlaceWebServiceExpress/src/routes/order.js`
  - `/sendorder` has a separate insert path for product sets; keep it aligned with `pos.js`.
- `MarketPlaceWebServiceExpress/src/routes/document.js` and history endpoints should avoid showing set child rows as duplicate top-level sale items.
- `MarketPlaceWebServiceExpress/src/routes/pos.js` `/getDashboardSoldOut` should exclude product-set parent items with `item_type = 3`; set parents do not hold stock directly and should not appear on sold-out pages.

## Persistence Rules

- Parent row:
  - `item_type = 3`
  - `ref_guid = uuid`
  - `set_ref_price = 0`
  - `ratio = 0`
- Child row:
  - `set_ref_line = parent.ref_guid`
  - `item_code_main = parent.item_code`
  - `item_type = 0`
  - `set_ref_price = child.price`
  - `set_ref_qty = child.qty_per_set`
  - `price_set_ratio = child.price_ratio`
  - `stand_value = 1`
  - `divide_value = 1`
  - `ratio = 0`
  - `qty = parent_qty * child_qty_per_set`
  - `sum_amount = child.price * parent_qty * child_qty_per_set`
- Normal rows:
  - Persist `ratio = 0` to match the main system.
  - Keep normal price, discount, VAT, unit, warehouse, and shelf calculations unchanged.

## Known Reference Documents

- `INV-26050062` is the main-system correct reference for the product-set sale tested during this work.
- `INV-26050064` is the staff-created document that matched `INV-26050062` after the product-set fixes, except harmless numeric formatting differences.
- Earlier `INV-26050061` exposed the bad child `sum_amount` for set item `03-0181`.
- Earlier `INV-26050063` fixed child sums but still exposed child ordering/metadata differences.
