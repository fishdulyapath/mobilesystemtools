# Database Validation

## Demo Database

The user commonly validates against a demo PostgreSQL database:

- Host: `demserver.3bbddns.com`
- Port: `47309`
- Database: `demo`
- Images database: `demo_images`
- Provider: `DEMO`

Do not persist secrets in this skill. Ask the user for credentials or use credentials already provided in the active thread/environment.

## Document Comparison

- Compare sale headers in `ic_trans` by `doc_no`.
- Staff-created document headers should have `ic_trans.creator_code = 'smlstaff'`. This value is sent by the `smlstaff-ubon` frontend because the backend service is shared; do not hard-code it in shared service routes or confuse it with employee/sale code fields.
- Compare sale rows in `ic_trans_detail` by `doc_no`, ordered by `line_number`.
- For product sets, compare:
  - parent rows: `item_type`, `ref_guid`, `qty`, `price`, `sum_amount`, `ratio`
  - child rows: `set_ref_line`, `item_code_main`, `set_ref_price`, `set_ref_qty`, `price_set_ratio`, `qty`, `price`, `sum_amount`, `stand_value`, `divide_value`, `ratio`
  - totals: `total_value`, `total_discount`, `discount_word`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_except_vat`, `total_amount`
- Numeric formatting differences such as `1` versus `1.000` are usually harmless if numeric values match.

## Safe Query Pattern

- Prefer read-only queries for comparison.
- If writing a new test document, clearly understand that it mutates demo data.
- Use transactions for manual repair scripts and roll back first when exploring.
