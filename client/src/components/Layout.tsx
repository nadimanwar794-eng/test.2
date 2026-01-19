import { ReactNode, useState, useEffect } from "react";
import { GraduationCap, RefreshCcw, ArrowLeft, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: appNameData } = useQuery({
    queryKey: ["/api/settings/app_name"],
    queryFn: async () => {
      const res = await fetch("/api/settings/app_name");
      return res.json();
    }
  });

  const updateAppName = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "app_name", value: name }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/app_name"] });
      toast({ title: "App name updated successfully" });
    }
  });

  const { data: sessionNameData } = useQuery({
    queryKey: ["/api/settings/session_name"],
    queryFn: async () => {
      const res = await fetch("/api/settings/session_name");
      return res.json();
    }
  });

  const updateSessionName = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "session_name", value: name }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/session_name"] });
      toast({ title: "Session name updated successfully" });
    }
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions");
      return res.json();
    }
  });

  const getActiveSessionName = () => {
    // 1. Try to get session from URL (e.g. /session/1/class/2)
    const sessionMatch = location.match(/\/session\/(\d+)/);
    if (sessionMatch) {
      const sessionId = parseInt(sessionMatch[1]);
      const session = sessions.find(s => s.id === sessionId);
      if (session) return `SESSION ${session.name}`;
    }

    // 2. Fallback to setting if no session in URL
    if (sessionNameData?.value) return sessionNameData.value;

    // 3. Ultimate fallback
    return "SESSION 2025-26";
  };

  const appName = appNameData?.value || "IIC ANNUAL TEST 2026";
  const sessionName = getActiveSessionName();

  const handleRestart = () => {
    window.location.reload();
  };

  const isLandingPage = location === "/";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Professional Academic Header */}
      <header className="bg-white border-b border-primary/10 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isLandingPage && (
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 mr-2">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
              </Link>
            )}
            <Link href="/">
              <div className="flex items-center gap-4 cursor-pointer group">
                <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:bg-primary/10 transition-colors">
                  <GraduationCap className="w-10 h-10 text-primary" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl md:text-3xl font-heading text-primary font-black tracking-tight leading-none group-hover:opacity-90 transition-opacity uppercase">
                    {appName}
                  </h1>
                  <p className="text-sm md:text-base font-medium text-muted-foreground tracking-widest uppercase mt-1">
                    {sessionName}
                  </p>
                </div>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            {user && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>App Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>App Name</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={newName} 
                          onChange={(e) => setNewName(e.target.value)} 
                          placeholder={appName}
                        />
                        <Button onClick={() => updateAppName.mutate(newName)}>Save</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Session Name (e.g. SESSION 2025-26)</Label>
                      <div className="flex gap-2">
                        <Input 
                          defaultValue={sessionName}
                          onBlur={(e) => updateSessionName.mutate(e.target.value)}
                          placeholder="SESSION 2025-26"
                        />
                        <Button variant="outline">Save</Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRestart}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary border-slate-200"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="bg-white border-t border-border py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 IIC Education System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
