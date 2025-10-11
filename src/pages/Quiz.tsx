import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, AlertCircle } from "lucide-react";

const Quiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await fetchQuiz();
    };
    checkAuth();
  }, [navigate, quizId]);

  const fetchQuiz = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: quizData } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();
      
      if (!quizData) {
        toast.error("Quiz not found");
        navigate("/courses");
        return;
      }
      setQuiz(quizData);

      const { data: questionsData } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at");
      setQuestions(questionsData || []);

      const { data: submission } = await supabase
        .from("quiz_submissions")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (submission) {
        setHasSubmitted(true);
      }
    } catch (error) {
      toast.error("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      toast.error("Please answer all questions");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let score = 0;
      questions.forEach((q) => {
        if (answers[q.id] === q.correct_answer) {
          score += q.points;
        }
      });

      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const percentage = (score / totalPoints) * 100;
      const passed = percentage >= quiz.passing_score;

      const { error: submissionError } = await supabase
        .from("quiz_submissions")
        .insert({
          user_id: user.id,
          quiz_id: quizId!,
          score: Math.round(percentage),
          answers: answers,
          passed,
        });

      if (submissionError) throw submissionError;

      if (passed) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (wallet) {
          const { data: currentWallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("id", wallet.id)
            .single();

          if (currentWallet) {
            await supabase.from("transactions").insert({
              wallet_id: wallet.id,
              amount: quiz.reward_amount,
              type: "reward",
              metadata: { quiz_id: quizId, quiz_title: quiz.title },
            });

            await supabase
              .from("wallets")
              .update({ balance: currentWallet.balance + quiz.reward_amount })
              .eq("id", wallet.id);

            toast.success(`Congratulations! You earned ${quiz.reward_amount} LearnChain Token (LCT)!`);
          }
        }
      } else {
        toast.error(`You scored ${percentage.toFixed(0)}%. You need ${quiz.passing_score}% to pass.`);
      }

      setHasSubmitted(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto text-center">
            <CardHeader>
              <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
              <CardTitle>Quiz Completed!</CardTitle>
              <CardDescription>You have already completed this quiz</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/courses")}>Back to Courses</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {quiz?.title}
            </h1>
            <p className="text-muted-foreground">{quiz?.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <span className="text-accent font-semibold">
                Reward: {quiz?.reward_amount} LearnChain Token (LCT)
              </span>
              <span className="text-muted-foreground">
                Passing Score: {quiz?.passing_score}%
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <Card key={question.id} className="shadow-elegant border-2 hover:border-primary/30 transition-all">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      Question {index + 1} of {questions.length}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {question.points} points
                    </span>
                  </div>
                  <CardTitle className="text-lg leading-relaxed">
                    {question.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={answers[question.id]?.toString()}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [question.id]: parseInt(value) })
                    }
                    className="space-y-3"
                  >
                    {question.options.map((option: string, optIndex: number) => (
                      <div 
                        key={optIndex} 
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-accent/5 ${
                          answers[question.id] === optIndex 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted'
                        }`}
                      >
                        <RadioGroupItem
                          value={optIndex.toString()}
                          id={`${question.id}-${optIndex}`}
                          className="mt-0"
                        />
                        <Label
                          htmlFor={`${question.id}-${optIndex}`}
                          className="cursor-pointer flex-1 text-sm leading-relaxed"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>Answer all questions to submit</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length !== questions.length}
              size="lg"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Quiz;
