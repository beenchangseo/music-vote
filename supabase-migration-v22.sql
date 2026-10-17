BEGIN;

ALTER TABLE setlist_items DROP CONSTRAINT IF EXISTS setlist_items_item_type_check;
ALTER TABLE setlist_items DROP CONSTRAINT IF EXISTS setlist_items_item_type_check;

ALTER TABLE setlist_items
  ADD CONSTRAINT setlist_items_item_type_check
  CHECK (item_type IN ('song', 'interval', 'original'));

COMMIT;