-- Create generation_queue table for background job processing (replaces Inngest)
CREATE TABLE public.generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('thesis', 'proposal')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz
);

GRANT ALL ON public.generation_queue TO service_role;

ALTER TABLE public.generation_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role can access the queue
CREATE POLICY "service_role_all" ON public.generation_queue
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for polling: find next pending job quickly
CREATE INDEX generation_queue_poll_idx ON public.generation_queue(status, created_at)
  WHERE status = 'pending';
