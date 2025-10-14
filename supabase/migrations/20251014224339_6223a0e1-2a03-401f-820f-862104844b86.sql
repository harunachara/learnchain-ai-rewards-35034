-- Add progress tracking to enrollments
ALTER TABLE public.enrollments
ADD COLUMN progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN last_activity_at timestamp with time zone DEFAULT now();

-- Create achievements table
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  earned_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Add streak tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN current_streak integer DEFAULT 0,
ADD COLUMN longest_streak integer DEFAULT 0,
ADD COLUMN last_active_date date;

-- Create AI chat messages table
CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  language text DEFAULT 'english',
  created_at timestamp with time zone DEFAULT now()
);

-- Add help tracking to quiz submissions
ALTER TABLE public.quiz_submissions
ADD COLUMN needs_help boolean DEFAULT false,
ADD COLUMN difficulty_level text DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard'));

-- Enable RLS on new tables
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Achievements policies
CREATE POLICY "Users can view their own achievements"
ON public.achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view leaderboard achievements"
ON public.achievements FOR SELECT
USING (true);

-- AI chat policies
CREATE POLICY "Users can view their own chat messages"
ON public.ai_chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat messages"
ON public.ai_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update streak
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS trigger AS $$
BEGIN
  -- Check if last active date is yesterday
  IF NEW.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN
    NEW.current_streak := OLD.current_streak + 1;
  ELSIF NEW.last_active_date < CURRENT_DATE - INTERVAL '1 day' THEN
    NEW.current_streak := 1;
  END IF;
  
  -- Update longest streak
  IF NEW.current_streak > OLD.longest_streak THEN
    NEW.longest_streak := NEW.current_streak;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for streak updates
CREATE TRIGGER update_streak_trigger
BEFORE UPDATE OF last_active_date ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_streak();

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void AS $$
DECLARE
  quiz_count integer;
  course_count integer;
  total_earned integer;
BEGIN
  -- Check quiz completion achievement
  SELECT COUNT(*) INTO quiz_count
  FROM quiz_submissions
  WHERE user_id = _user_id AND passed = true;
  
  IF quiz_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM achievements 
    WHERE user_id = _user_id AND achievement_type = 'first_quiz'
  ) THEN
    INSERT INTO achievements (user_id, achievement_type, title, description, icon)
    VALUES (_user_id, 'first_quiz', 'Quiz Master Beginner', 'Completed your first quiz!', '🎯');
  END IF;
  
  -- Check course enrollment achievement
  SELECT COUNT(*) INTO course_count
  FROM enrollments
  WHERE user_id = _user_id;
  
  IF course_count >= 5 AND NOT EXISTS (
    SELECT 1 FROM achievements 
    WHERE user_id = _user_id AND achievement_type = 'five_courses'
  ) THEN
    INSERT INTO achievements (user_id, achievement_type, title, description, icon)
    VALUES (_user_id, 'five_courses', 'Course Explorer', 'Enrolled in 5 courses!', '📚');
  END IF;
  
  -- Check token earning achievement
  SELECT COALESCE(balance, 0) INTO total_earned
  FROM wallets
  WHERE user_id = _user_id;
  
  IF total_earned >= 100 AND NOT EXISTS (
    SELECT 1 FROM achievements 
    WHERE user_id = _user_id AND achievement_type = 'hundred_tokens'
  ) THEN
    INSERT INTO achievements (user_id, achievement_type, title, description, icon)
    VALUES (_user_id, 'hundred_tokens', 'Token Collector', 'Earned 100 LCT!', '💰');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for better performance
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX idx_ai_chat_messages_user_course ON public.ai_chat_messages(user_id, course_id);
CREATE INDEX idx_enrollments_progress ON public.enrollments(user_id, progress_percentage);