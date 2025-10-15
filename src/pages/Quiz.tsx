import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy, AlertCircle, Clock, CheckCircle2, XCircle, History, RefreshCw } from "lucide-react";

const Quiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

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

  useEffect(() => {
    if (quiz?.time_limit && !currentSubmission) {
      setTimeLeft(quiz.time_limit * 60);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev && prev <= 1) {
            handleSubmit();
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quiz, currentSubmission]);

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

      const { data: submissionsData } = await supabase
        .from("quiz_submissions")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("user_id", user.id)
        .order("attempt_number", { ascending: false });
      
      setSubmissions(submissionsData || []);
      if (submissionsData && submissionsData.length > 0 && !quizData.allow_retakes) {
        setCurrentSubmission(submissionsData[0]);
      }
    } catch (error) {
      toast.error("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setCurrentSubmission(null);
    setAnswers({});
    setTimeLeft(quiz.time_limit ? quiz.time_limit * 60 : null);
  };

  const handleSubmit = async () => {
    if (!currentSubmission && Object.keys(answers).length !== questions.length) {
      toast.error("Please answer all questions");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let score = 0;
      const detailedResults = questions.map((q) => {
        const userAnswer = answers[q.id];
        let isCorrect = false;

        if (q.question_type === 'fill_in_blank') {
          isCorrect = userAnswer?.toLowerCase().trim() === q.options[0]?.toLowerCase().trim();
        } else {
          isCorrect = userAnswer === q.correct_answer;
        }

        if (isCorrect) score += q.points;

        return {
          question_id: q.id,
          question: q.question,
          user_answer: userAnswer,
          correct_answer: q.correct_answer,
          is_correct: isCorrect,
          explanation: q.explanation,
          question_type: q.question_type,
          options: q.options
        };
      });

      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const percentage = (score / totalPoints) * 100;
      const passed = percentage >= quiz.passing_score;
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const attemptNumber = (submissions.length || 0) + 1;

      const { error: submissionError } = await supabase
        .from("quiz_submissions")
        .insert({
          user_id: user.id,
          quiz_id: quizId!,
          score: Math.round(percentage),
          answers: answers,
          passed,
          attempt_number: attemptNumber,
          time_taken: timeTaken,
          detailed_results: detailedResults
        });

      if (submissionError) throw submissionError;

      if (passed) {
        const { error: rewardError } = await supabase.rpc('process_quiz_reward', {
          p_user_id: user.id,
          p_quiz_id: quizId!,
          p_reward_amount: quiz.reward_amount,
          p_quiz_title: quiz.title
        });

        if (rewardError) {
          console.error('Reward error:', rewardError);
          toast.error('Quiz submitted but reward failed. Please contact support.');
        } else {
          toast.success(`Quiz completed! You earned ${quiz.reward_amount} LCT! Score: ${percentage.toFixed(0)}%`);
        }
      } else {
        toast.info(`Quiz completed. Score: ${percentage.toFixed(0)}%. Try again to pass!`);
      }

      setCurrentSubmission({ 
        score: Math.round(percentage), 
        passed,
        detailed_results: detailedResults,
        attempt_number: attemptNumber,
        time_taken: timeTaken
      });
      await fetchQuiz();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (currentSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="results" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="results">Results & Answers</TabsTrigger>
              <TabsTrigger value="history">Attempt History</TabsTrigger>
            </TabsList>

            <TabsContent value="results">
              <Card className="shadow-elegant mb-6">
                <CardHeader className="text-center">
                  {currentSubmission.passed ? (
                    <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
                  ) : (
                    <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                  )}
                  <CardTitle className="text-3xl">
                    {currentSubmission.passed ? "Congratulations!" : "Keep Learning!"}
                  </CardTitle>
                  <CardDescription className="text-lg mt-2">
                    Score: {currentSubmission.score}% | Time: {formatTime(currentSubmission.time_taken)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quiz.allow_retakes && (
                    <Button onClick={handleRetake} className="w-full gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Retake Quiz
                    </Button>
                  )}
                  <Button onClick={() => navigate("/courses")} variant="outline" className="w-full">
                    Back to Courses
                  </Button>
                </CardContent>
              </Card>

              {quiz.show_explanations && currentSubmission.detailed_results && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">Review Answers</h2>
                  {currentSubmission.detailed_results.map((result: any, index: number) => (
                    <Card key={index} className={`shadow-elegant border-2 ${result.is_correct ? 'border-green-500/50' : 'border-red-500/50'}`}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          {result.is_correct ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">{result.question}</CardTitle>
                            {result.question_type === 'fill_in_blank' ? (
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Your answer:</span>
                                  <span className={result.is_correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                    {result.user_answer || '(No answer)'}
                                  </span>
                                </div>
                                {!result.is_correct && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Correct answer:</span>
                                    <span className="text-green-600 font-medium">{result.options[0]}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Your answer:</span>
                                  <span className={result.is_correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                    {result.options[result.user_answer]}
                                  </span>
                                </div>
                                {!result.is_correct && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Correct answer:</span>
                                    <span className="text-green-600 font-medium">{result.options[result.correct_answer]}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {result.explanation && (
                        <CardContent>
                          <div className="bg-muted/50 p-4 rounded-lg">
                            <p className="text-sm font-medium mb-1">Explanation:</p>
                            <p className="text-sm text-muted-foreground">{result.explanation}</p>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-6 h-6" />
                    Attempt History
                  </CardTitle>
                  <CardDescription>View all your quiz attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  {submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No attempts yet</p>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map((sub, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium">Attempt #{sub.attempt_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${sub.passed ? 'text-green-600' : 'text-orange-600'}`}>
                              {sub.score}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(sub.time_taken || 0)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
            <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
              <span className="text-accent font-semibold">
                Reward: {quiz?.reward_amount} LCT
              </span>
              <span className="text-muted-foreground">
                Passing Score: {quiz?.passing_score}%
              </span>
              {quiz?.time_limit && timeLeft !== null && (
                <span className={`font-semibold flex items-center gap-1 ${timeLeft < 60 ? 'text-red-500' : 'text-primary'}`}>
                  <Clock className="w-4 h-4" />
                  Time Left: {formatTime(timeLeft)}
                </span>
              )}
              {submissions.length > 0 && (
                <span className="text-muted-foreground">
                  Attempt #{submissions.length + 1}
                </span>
              )}
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
                  {question.image_url && (
                    <img src={question.image_url} alt="Question visual" className="mt-4 rounded-lg max-h-64 object-contain" />
                  )}
                </CardHeader>
                <CardContent>
                  {question.question_type === 'fill_in_blank' ? (
                    <Input
                      placeholder="Type your answer here..."
                      value={answers[question.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      className="text-base"
                    />
                  ) : (
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
                  )}
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
