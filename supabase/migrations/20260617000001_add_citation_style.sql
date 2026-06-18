-- ══════════════════════════════════════════════════════════
-- MIGRATION: Add citation_style column to proposals & theses
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS citation_style text NOT NULL DEFAULT 'apa_7';

ALTER TABLE public.theses 
  ADD COLUMN IF NOT EXISTS citation_style text NOT NULL DEFAULT 'apa_7';

-- Default existing records to apa_7
UPDATE public.proposals SET citation_style = 'apa_7' WHERE citation_style IS NULL;
UPDATE public.theses SET citation_style = 'apa_7' WHERE citation_style IS NULL;
