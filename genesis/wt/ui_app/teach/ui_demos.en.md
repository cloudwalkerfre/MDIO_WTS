# UI_DEMOS

## Demos

The same data can be rendered two ways by declaration; a field list is read straight from the live tree, and "append a row" really writes back to md. Both demos live in this page's mods, not in a separate wt.

### swap

- Title: Same data · two renderings
- Data: 42
- Note: it flips one line of `## match` in `.mds/ui.md` (SWAP_A ↔ SWAP_B); declarations hot-reload, no refresh needed

### field

- Table: Users
- Primary key: id · bigint
- Index: idx_email (unique)
- Index: idx_created_at
- Note: repeated tags with the same name collapse into an array; "append a row" really writes into this section's md
- Index: 123
