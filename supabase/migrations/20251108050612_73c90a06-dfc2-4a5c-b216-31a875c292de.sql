-- Add video_url column to enrollments table to store generated course introduction videos
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS video_url text;