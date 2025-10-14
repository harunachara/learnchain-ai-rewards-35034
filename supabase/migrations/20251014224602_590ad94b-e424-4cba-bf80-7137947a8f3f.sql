-- Fix security warnings by setting search_path on functions

-- Update update_user_streak function
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Update check_achievements function
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;