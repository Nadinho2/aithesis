-- Backfill: Mark completed transactions as used for proposals and theses
-- where a completed document already exists for that user+product+level.
-- This ensures existing used credits don't show as "Available" in admin.

-- Theses: mark oldest transactions that have corresponding completed theses
UPDATE public.transactions t
SET used = true
FROM (
  SELECT DISTINCT ON (tx.user_id, tx.level)
    tx.id
  FROM public.transactions tx
  INNER JOIN public.theses th
    ON th.user_id = tx.user_id
   AND th.level = tx.level
   AND th.status = 'completed'
  WHERE tx.product = 'thesis'
    AND tx.status = 'completed'
    AND tx.used = false
  ORDER BY tx.user_id, tx.level, tx.created_at ASC
) sub
WHERE t.id = sub.id;

-- Proposals: mark oldest transactions that have corresponding completed proposals
UPDATE public.transactions t
SET used = true
FROM (
  SELECT DISTINCT ON (tx.user_id)
    tx.id
  FROM public.transactions tx
  INNER JOIN public.proposals p
    ON p.user_id = tx.user_id
   AND p.status = 'completed'
  WHERE tx.product = 'proposal'
    AND tx.status = 'completed'
    AND tx.used = false
  ORDER BY tx.user_id, tx.created_at ASC
) sub
WHERE t.id = sub.id;
