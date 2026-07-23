-- Create admin-controlled settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Enable RLS but allow admin-only access via service role
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Insert default pricing (does nothing if keys already exist)
INSERT INTO settings (key, value) VALUES
  ('price:proposal', '{"label":"Research Proposal","price":5000,"currency":"NGN"}'),
  ('price:thesis:undergraduate', '{"label":"Undergraduate Thesis","price":20000,"currency":"NGN"}'),
  ('price:thesis:masters', '{"label":"Masters Thesis","price":40000,"currency":"NGN"}'),
  ('price:thesis:phd', '{"label":"PhD Thesis","price":50000,"currency":"NGN"}'),
  ('price:assignment', '{"label":"Assignment Assistant","price":1000,"currency":"NGN"}'),
  ('price:exam', '{"label":"Exam Preparation","price":1000,"currency":"NGN"}'),
  ('price:presentation', '{"label":"Presentation Assistant","price":3000,"currency":"NGN"}'),
  ('price:cv', '{"label":"CV Maker","price":3000,"currency":"NGN"}'),
  ('price:seminar_journal', '{"label":"Journal / Conference Paper","price":3500,"currency":"NGN"}'),
  ('price:seminar_departmental', '{"label":"Departmental Seminar Paper","price":2000,"currency":"NGN"}'),
  ('price:seminar_postgraduate', '{"label":"Postgraduate Research Seminar","price":2500,"currency":"NGN"}'),
  ('price:seminar_technical', '{"label":"Technical / Engineering Seminar","price":2500,"currency":"NGN"}'),
  ('price:seminar_book_review', '{"label":"Book Review Seminar","price":1500,"currency":"NGN"}'),
  ('tool:topics:enabled', 'true'),
  ('tool:proposal:enabled', 'true'),
  ('tool:thesis:enabled', 'true'),
  ('tool:assignment:enabled', 'true'),
  ('tool:exam:enabled', 'true'),
  ('tool:presentation:enabled', 'true'),
  ('tool:cv:enabled', 'true'),
  ('tool:seminar:enabled', 'true')
ON CONFLICT (key) DO NOTHING;
