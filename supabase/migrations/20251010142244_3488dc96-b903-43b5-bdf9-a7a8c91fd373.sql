-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reward_amount INTEGER NOT NULL DEFAULT 5,
  passing_score INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quiz_questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of options
  correct_answer INTEGER NOT NULL, -- Index of correct option
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quiz_submissions table
CREATE TABLE public.quiz_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL, -- User's answers
  passed BOOLEAN NOT NULL,
  reward_issued BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quizzes
CREATE POLICY "Anyone can view quizzes"
  ON public.quizzes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage quizzes"
  ON public.quizzes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for quiz_questions
CREATE POLICY "Anyone can view questions"
  ON public.quiz_questions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage questions"
  ON public.quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for quiz_submissions
CREATE POLICY "Users can view their submissions"
  ON public.quiz_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create submissions"
  ON public.quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample quizzes for existing courses
INSERT INTO public.quizzes (course_id, title, description, reward_amount, passing_score)
SELECT id, title || ' Quiz', 'Test your knowledge of ' || title, 5, 70
FROM public.courses;

-- Insert sample questions for each quiz
WITH quiz_ids AS (
  SELECT id, course_id FROM public.quizzes
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, points)
SELECT 
  q.id,
  'Sample question for ' || c.title,
  '["Option A", "Option B", "Option C", "Option D"]'::jsonb,
  0,
  10
FROM quiz_ids q
JOIN public.courses c ON q.course_id = c.id;