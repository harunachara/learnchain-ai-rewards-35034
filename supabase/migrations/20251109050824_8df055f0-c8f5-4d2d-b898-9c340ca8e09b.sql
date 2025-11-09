-- Create math_solutions table
CREATE TABLE IF NOT EXISTS public.math_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  problem_text TEXT,
  solution TEXT,
  language TEXT DEFAULT 'english',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.math_solutions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own solutions"
  ON public.math_solutions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own solutions"
  ON public.math_solutions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_math_solutions_user_id ON public.math_solutions(user_id);
CREATE INDEX idx_math_solutions_created_at ON public.math_solutions(created_at DESC);