-- Add foreign key constraint for quizzes to chapters
ALTER TABLE public.quizzes 
ADD CONSTRAINT quizzes_chapter_id_fkey 
FOREIGN KEY (chapter_id) 
REFERENCES public.chapters(id) 
ON DELETE CASCADE;