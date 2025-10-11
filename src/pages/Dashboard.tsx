import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, BookOpen, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await fetchData();
    };
    checkAuth();
  }, [navigate]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch wallet
      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setWallet(walletData);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*, courses(title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setProjects(projectsData || []);

      // Fetch enrollments
      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("user_id", user.id);
      setEnrollments(enrollmentsData || []);

    } catch (error: any) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Your Learning Dashboard
          </h1>
          <p className="text-muted-foreground">Track your progress and earn rewards</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Wallet Card */}
          <Card className="shadow-elegant hover:shadow-glow transition-shadow cursor-pointer" onClick={() => navigate("/wallet")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">LearnChain Token Balance</CardTitle>
              <Wallet className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                {wallet?.balance || 0} LearnChain Token (LCT)
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click to view wallet</p>
            </CardContent>
          </Card>

          {/* Courses Card */}
          <Card className="shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
              <BookOpen className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{enrollments.length}</div>
              <p className="text-xs text-muted-foreground mt-2">
                <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/courses")}>
                  Browse courses
                </Button>
              </p>
            </CardContent>
          </Card>

          {/* Projects Card */}
          <Card className="shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed Projects</CardTitle>
              <Trophy className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {projects.filter(p => p.status === 'approved').length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Keep learning!</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Recent Projects
            </CardTitle>
            <CardDescription>Your latest learning activities</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No projects yet</p>
                <Button onClick={() => navigate("/courses")}>
                  Start Learning
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/5 transition-colors">
                    <div>
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="text-sm text-muted-foreground">{project.courses?.title}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        project.status === 'approved' ? 'bg-accent/20 text-accent' :
                        project.status === 'rejected' ? 'bg-destructive/20 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {project.status}
                      </span>
                      <span className="text-sm font-medium text-accent">+{project.reward_amount} LearnChain Token (LCT)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default Dashboard;