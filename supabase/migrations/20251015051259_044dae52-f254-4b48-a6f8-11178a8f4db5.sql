-- Add timer and retake support to quizzes
ALTER TABLE quizzes 
ADD COLUMN time_limit integer,
ADD COLUMN allow_retakes boolean DEFAULT true,
ADD COLUMN show_explanations boolean DEFAULT true;

-- Add new question types and explanations
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'fill_in_blank');

ALTER TABLE quiz_questions
ADD COLUMN question_type question_type DEFAULT 'multiple_choice',
ADD COLUMN explanation text,
ADD COLUMN image_url text;

-- Add attempt tracking to submissions
ALTER TABLE quiz_submissions
ADD COLUMN attempt_number integer DEFAULT 1,
ADD COLUMN time_taken integer,
ADD COLUMN detailed_results jsonb;

-- Create index for better query performance
CREATE INDEX idx_quiz_submissions_user_quiz ON quiz_submissions(user_id, quiz_id);

COMMENT ON COLUMN quizzes.time_limit IS 'Time limit in minutes, NULL for no limit';
COMMENT ON COLUMN quizzes.allow_retakes IS 'Whether users can retake this quiz';
COMMENT ON COLUMN quizzes.show_explanations IS 'Whether to show explanations after submission';
COMMENT ON COLUMN quiz_questions.explanation IS 'AI-generated explanation for the answer';
COMMENT ON COLUMN quiz_questions.image_url IS 'Optional image URL for visual questions';
COMMENT ON COLUMN quiz_submissions.attempt_number IS 'Which attempt this is (1, 2, 3, etc.)';
COMMENT ON COLUMN quiz_submissions.time_taken IS 'Time taken in seconds';
COMMENT ON COLUMN quiz_submissions.detailed_results IS 'Detailed breakdown of answers with explanations';