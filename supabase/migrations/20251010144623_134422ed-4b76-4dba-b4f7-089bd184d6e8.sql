-- Add course_materials table for handouts/notes
CREATE TABLE public.course_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  material_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add chapters table
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  chapter_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Modify quizzes to link to chapters
ALTER TABLE public.quizzes ADD COLUMN chapter_id UUID;

-- Enable RLS
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_materials
CREATE POLICY "Anyone can view course materials"
ON public.course_materials
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage course materials"
ON public.course_materials
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for chapters
CREATE POLICY "Anyone can view chapters"
ON public.chapters
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage chapters"
ON public.chapters
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for timestamps
CREATE TRIGGER update_course_materials_updated_at
BEFORE UPDATE ON public.course_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
BEFORE UPDATE ON public.chapters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing courses and add new comprehensive curriculum
TRUNCATE public.courses CASCADE;

-- PRIMARY LEVEL COURSES
INSERT INTO public.courses (title, description, category) VALUES
('Basic Computer Skills', 'Learn how to use a computer, mouse, and keyboard safely.', 'primary'),
('Introduction to Coding (Blockly)', 'Learn simple programming using games and visual blocks.', 'primary'),
('Science Around Us', 'Fun experiments and nature lessons kids can do at home.', 'primary'),
('Art and Creativity', 'Drawing, painting, and crafting from recycled materials.', 'primary'),
('Storytelling and Reading', 'Develop reading and writing skills through stories.', 'primary'),
('Math Games', 'Learn math through puzzles and interactive games.', 'primary'),
('Moral and Civic Education', 'Understand honesty, teamwork, and respect.', 'primary'),
('Digital Safety for Kids', 'Learn safe online behavior and privacy basics.', 'primary'),
('Environment and Climate Fun', 'Learn about plants, recycling, and keeping our planet clean.', 'primary'),
('Music and Rhythm', 'Explore songs, beats, and sound creation.', 'primary');

-- SECONDARY LEVEL COURSES
INSERT INTO public.courses (title, description, category) VALUES
('Python for Beginners', 'Learn to code using Python for games and automation.', 'secondary'),
('AI & Robotics for Teens', 'Understand how robots and AI make smart decisions.', 'secondary'),
('Web Design & HTML Basics', 'Build your first simple website or portfolio.', 'secondary'),
('Mobile Photography & Video Editing', 'Learn visual storytelling using smartphones.', 'secondary'),
('Financial Literacy for Students', 'Learn budgeting, savings, and digital money.', 'secondary'),
('Public Speaking & Communication', 'Develop confidence and presentation skills.', 'secondary'),
('Intro to Blockchain and Crypto', 'Learn what blockchain is and why it matters.', 'secondary'),
('Science Experiments & Innovation Lab', 'DIY experiments for physics, chemistry, and biology.', 'secondary'),
('Creative Writing & Blogging', 'Express yourself online responsibly.', 'secondary'),
('Entrepreneurship for Teens', 'Turn hobbies into business ideas.', 'secondary');

-- HIGH LEVEL COURSES
INSERT INTO public.courses (title, description, category) VALUES
('Artificial Intelligence & Machine Learning', 'Learn how machines think, predict, and learn.', 'high_level'),
('Data Science & Analytics', 'Learn to analyze real-world data for insights.', 'high_level'),
('Blockchain Development', 'Learn smart contracts and decentralized apps.', 'high_level'),
('Cybersecurity Fundamentals', 'Learn to protect data and systems.', 'high_level'),
('Software Engineering Foundations', 'Build and deploy real applications.', 'high_level'),
('Product Design (UI/UX)', 'Create user-centered interfaces and experiences.', 'high_level'),
('Digital Marketing & Branding', 'Learn online promotion, content, and analytics.', 'high_level'),
('Renewable Energy Systems', 'Understand solar, wind, and sustainable energy.', 'high_level'),
('AI in Healthcare', 'Learn how AI transforms medical systems.', 'high_level'),
('Research & Innovation Lab', 'Learn how to turn ideas into impactful projects.', 'high_level');