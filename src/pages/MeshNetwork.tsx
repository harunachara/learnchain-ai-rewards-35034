import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Download, Users, Wifi, Database } from "lucide-react";
import { meshNetwork } from "@/lib/meshNetwork";
import { offlineStorage } from "@/lib/offlineStorage";
import { toast } from "sonner";

export default function MeshNetwork() {
  const navigate = useNavigate();
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [peers, setPeers] = useState<any[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<any[]>([]);
  const [storageInfo, setStorageInfo] = useState({ courses: 0, total: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const courses = await offlineStorage.getAllCourses();
    const storage = await offlineStorage.getStorageSize();
    setOfflineCourses(courses);
    setStorageInfo(storage);
  };

  const handleToggleSharing = (enabled: boolean) => {
    setSharingEnabled(enabled);
    meshNetwork.setSharingEnabled(enabled);
    toast.success(enabled ? "Sharing enabled" : "Sharing disabled");
  };

  const handleDiscoverPeers = async () => {
    toast.info("Discovering nearby peers...");
    const peerIds = await meshNetwork.discoverPeers();
    const peerList = meshNetwork.getPeers();
    setPeers(peerList);
    toast.success(`Found ${peerList.length} peers`);
  };

  const handleRequestCourse = async (peerId: string, courseId: string) => {
    const success = await meshNetwork.requestCourse(peerId, courseId);
    if (success) {
      toast.success("Course requested");
    } else {
      toast.error("Failed to request course");
    }
  };

  const handleClearCache = async () => {
    if (confirm("Are you sure you want to clear all offline data?")) {
      await offlineStorage.clearAll();
      await loadData();
      toast.success("Cache cleared");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mesh Network</h1>
            <p className="text-muted-foreground">
              Share and discover courses offline through peer-to-peer connections
            </p>
          </div>

          {/* Storage Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Offline Storage
              </CardTitle>
              <CardDescription>Your downloaded content available offline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{storageInfo.courses}</p>
                  <p className="text-sm text-muted-foreground">Courses offline</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{storageInfo.total}</p>
                  <p className="text-sm text-muted-foreground">Total items</p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleClearCache} className="w-full">
                Clear All Cache
              </Button>
            </CardContent>
          </Card>

          {/* Sharing Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Sharing Settings
              </CardTitle>
              <CardDescription>Allow others to download courses from you</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Course Sharing</p>
                <p className="text-sm text-muted-foreground">
                  Share your downloaded courses with nearby peers
                </p>
              </div>
              <Switch checked={sharingEnabled} onCheckedChange={handleToggleSharing} />
            </CardContent>
          </Card>

          {/* Peer Discovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Nearby Peers
              </CardTitle>
              <CardDescription>Students nearby who can share courses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleDiscoverPeers} className="w-full">
                <Wifi className="h-4 w-4 mr-2" />
                Discover Peers
              </Button>

              {peers.length > 0 ? (
                <div className="space-y-2">
                  {peers.map((peer) => (
                    <Card key={peer.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{peer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {peer.availableCourses.length} courses available
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Browse
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No peers found. Make sure Bluetooth and WiFi are enabled.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Offline Courses */}
          <Card>
            <CardHeader>
              <CardTitle>Your Offline Courses</CardTitle>
              <CardDescription>Courses available without internet</CardDescription>
            </CardHeader>
            <CardContent>
              {offlineCourses.length > 0 ? (
                <div className="space-y-2">
                  {offlineCourses.map((course) => (
                    <Card key={course.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{course.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Cached {new Date(course.cached_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/course/${course.id}`)}
                          >
                            Open
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No offline courses yet. Download courses from the courses page.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
