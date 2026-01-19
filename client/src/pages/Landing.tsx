import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ArrowRight, GraduationCap, Building2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const { user, loginMutation } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    loginMutation.mutate({ email, password });
    setShowLogin(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 relative">
      {/* Subtle Admin Trigger in Corner */}
      {!user && (
        <div 
          className="absolute bottom-4 right-4 opacity-10 hover:opacity-100 transition-opacity cursor-pointer group p-2"
          onClick={() => setShowLogin(true)}
          title="IIC Admin"
        >
          <div className="bg-slate-200 p-2 rounded-lg border border-slate-300">
            <Building2 className="h-4 w-4 text-slate-600" />
          </div>
        </div>
      )}

      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="mx-auto bg-white p-4 rounded-full shadow-sm w-20 h-20 flex items-center justify-center">
             <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">IIC Results Page</h1>
          <p className="text-slate-500">
            View results, check performance, and track progress.
          </p>
        </div>

        <div className="grid gap-4">
          <Link href="/sessions">
            <Button size="lg" className="w-full gap-2 text-lg h-14">
              View Results <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

          {user && (
            <Link href="/sessions">
              <Button variant="secondary" size="lg" className="w-full gap-2 text-lg h-14">
                Admin Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>IIC OFFICE Login</DialogTitle>
            <DialogDescription>
              Enter admin credentials to manage students and sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin Email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={handleLogin} disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
