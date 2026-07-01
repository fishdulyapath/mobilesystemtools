# Cart, Basket, And PU Notes

## Basket Reset And Shared Cart

- Two devices can share a cart because basket/cart state is persisted centrally in the backend, commonly with a key like `BASKET-{id}`.
- Race risk: the frontend may clear the basket locally while an older async update still posts stale rows afterward.
- Staff frontend mitigation:
  - Guard pending cart writes during clear/unmount.
  - Avoid sending stale cart payload after reset.
- Backend mitigation:
  - Lock basket operations in `setBasketInfo`.
  - If a basket was already empty/reset, delete stale `staff_cart_order` rows.
  - Ignore `additemtocart` for inactive/non-active `BASKET-{id}`.
- When investigating stale cart data, inspect both frontend pending-write behavior and backend basket status/order rows.

## PU Footer Discount

- Staff PU create/edit should include a footer discount like the sale menu.
- The relevant frontend file is `smlstaff-ubon/src/views/PurchasePUView.vue`.
- Keep discount formula aligned with sale behavior: footer discount affects document totals, not individual item quantities.

## PU Stock Balance

- After saving or updating a PU, refresh `ic_inventory.balance_qty` from the true stock balance function.
- Use this pattern per affected `item_code`:

```js
const newBalRes = await client.query(
  `SELECT COALESCE(SUM(balance_qty), 0) AS new_balance
   FROM sml_ic_function_stock_balance_warehouse_location('NOW()', $1, '', '')`,
  [item_code],
);
const new_balance = Number(newBalRes.rows[0].new_balance);
await client.query(`UPDATE ic_inventory SET balance_qty = $1 WHERE code = $2`, [new_balance, item_code]);
```

- On PU edit, include both new item codes and old/deleted item codes so removing a line also updates `balance_qty`.
