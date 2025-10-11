import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId, hobby } = await req.json();
    
    if (!courseId || !hobby) {
      return new Response(
        JSON.stringify({ error: "courseId and hobby are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Fetch course details
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Fetch existing chapters
    const { data: chapters } = await supabase
      .from("chapters")
      .select("*")
      .eq("course_id", courseId)
      .order("chapter_order");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Generate personalized course materials
    const materialsPrompt = `You are an expert educational content creator. Generate personalized course handout/notes for a student interested in "${hobby}".

Course: ${course.title}
Description: ${course.description}

Create engaging, personalized course introduction materials that connect the course content to the student's hobby "${hobby}". Make it practical and relatable.

Format your response as JSON:
{
  "title": "Introduction to [Course Name] for [Hobby] Enthusiasts",
  "content": "Comprehensive markdown content that includes:\n- Introduction connecting the course to their hobby\n- Key learning objectives\n- Real-world applications related to their hobby\n- Fun facts and motivational content"
}`;

    const materialsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: materialsPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!materialsResponse.ok) {
      const errorText = await materialsResponse.text();
      console.error("AI materials generation error:", materialsResponse.status, errorText);
      
      if (materialsResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      
      if (materialsResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please contact support." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate course materials" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const materialsData = await materialsResponse.json();
    const materialsContent = JSON.parse(materialsData.choices[0].message.content);

    // Insert personalized course material
    const { error: materialError } = await supabase
      .from("course_materials")
      .insert({
        course_id: courseId,
        title: materialsContent.title,
        content: materialsContent.content,
        material_order: 1
      });

    if (materialError) {
      console.error("Error inserting course material:", materialError);
    }

    // Generate personalized quizzes for each chapter
    if (chapters && chapters.length > 0) {
      for (const chapter of chapters) {
        const quizPrompt = `You are an expert educator. Create a personalized quiz for a student interested in "${hobby}".

Chapter: ${chapter.title}
Description: ${chapter.description}
Course: ${course.title}

Create 5 engaging quiz questions that test understanding of the chapter while relating to the student's hobby "${hobby}". Make questions practical and scenario-based when possible.

Format your response as JSON:
{
  "quiz_title": "Quiz title",
  "questions": [
    {
      "question": "Question text (relate to ${hobby} when possible)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "points": 10
    }
  ]
}`;

        const quizResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "user", content: quizPrompt }
            ],
            response_format: { type: "json_object" }
          }),
        });

        if (quizResponse.ok) {
          const quizData = await quizResponse.json();
          const quizContent = JSON.parse(quizData.choices[0].message.content);

          // Create quiz
          const { data: quiz, error: quizError } = await supabase
            .from("quizzes")
            .insert({
              course_id: courseId,
              chapter_id: chapter.id,
              title: quizContent.quiz_title,
              description: `Personalized quiz for ${hobby} enthusiasts`,
              passing_score: 70,
              reward_amount: 5
            })
            .select()
            .single();

          if (quiz && !quizError) {
            // Insert quiz questions
            const questions = quizContent.questions.map((q: any) => ({
              quiz_id: quiz.id,
              question: q.question,
              options: q.options,
              correct_answer: q.correct_answer,
              points: q.points
            }));

            await supabase.from("quiz_questions").insert(questions);
          }
        }
      }
    }

    // Enroll the user
    const { error: enrollError } = await supabase
      .from("enrollments")
      .insert({
        user_id: user.id,
        course_id: courseId
      });

    if (enrollError) {
      console.error("Enrollment error:", enrollError);
      return new Response(
        JSON.stringify({ error: "Failed to enroll in course" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully enrolled with personalized content!"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-personalized-course:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
