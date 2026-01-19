import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useStudent } from "@/hooks/use-students";
import { useUpdateMarks } from "@/hooks/use-marks";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Save, ArrowLeft, TrendingUp, Calendar, BookOpen, Calculator, Award, GraduationCap, Trash2, Lock, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { insertMarkSchema, type Mark } from "@shared/schema";
import { api } from "@shared/routes";

interface EditableMark {
  localId: string;
  id?: number;
  subject: string;
  date: string;
  obtained: string;
  max: number;
}

export default function StudentDetails() {
  const { id } = useParams();
  const studentId = Number(id);
  const { data: student, isLoading, error } = useStudent(studentId);
  const updateMutation = useUpdateMarks();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = !!user;

  const [showLockedPopup, setShowLockedPopup] = useState(false);

  useEffect(() => {
    // Locked results disabled per user request
    if (false && student && !student.isPaid && !isAdmin) {
      setShowLockedPopup(true);
    }
  }, [student, isAdmin]);

  const [marks, setMarks] = useState<EditableMark[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (student) {
      const initialMarks = student.marks.map((m: any) => ({
        localId: `db-${m.id}`,
        id: m.id,
        subject: m.subject.name || "General",
        date: m.subject.date || new Date().toISOString().split("T")[0],
        obtained: m.obtained.toString(),
        max: m.subject.maxMarks,
      }));
      setMarks(initialMarks);
    }
  }, [student]);

  const handleAddBox = () => {
    const newMark: EditableMark = {
      localId: `new-${Date.now()}`,
      subject: "",
      date: new Date().toISOString().split("T")[0],
      obtained: "0",
      max: 80,
    };
    setMarks((prev) => [...prev, newMark]);
    setIsDirty(true);
  };

  const handleMarkChange = (index: number, field: keyof EditableMark, value: any) => {
    setMarks((prev) => {
      const newMarks = [...prev];
      newMarks[index] = { ...newMarks[index], [field]: value };
      return newMarks;
    });
    setIsDirty(true);
  };

  const handleRemoveBox = (index: number) => {
    setMarks(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      const payload = marks
        .filter(m => m.subject.trim() !== "")
        .map((m) => ({
          id: m.id,
          subject: m.subject,
          date: m.date,
          obtained: m.obtained.toString(),
          max: Number(m.max),
        }));

      // Directly update marks
      await updateMutation.mutateAsync({
        studentId,
        marks: payload,
      });

      toast({ title: "Saved!", description: "Student marks have been updated." });
      setIsDirty(false);
      
      // Force refresh data from server
      await queryClient.invalidateQueries({ queryKey: [api.students.get.path, { id: studentId }] });
      await queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
      
      // Give small delay for DB to propagate then reload
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const stats = useMemo(() => {
    const totalObtained = marks.reduce((sum, m) => sum + (parseFloat(m.obtained) || 0), 0);
    const totalMax = marks.reduce((sum, m) => sum + Number(m.max || 0), 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    return { totalObtained, totalMax, percentage };
  }, [marks]);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !student) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
           <h2 className="text-xl font-bold text-destructive mb-4">Student not found</h2>
           <Link href="/"><Button variant="outline">Go Back Home</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn("space-y-8 pb-20")}>
        <div className="sticky top-24 z-40 bg-white/95 backdrop-blur-md border border-border shadow-md rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href={`/class/${student.classId}`}>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
            </Link>
            <div>
                <h1 className="text-2xl font-heading font-bold text-primary">{student.name}</h1>
                <p className="text-sm text-muted-foreground font-medium">Roll No. {student.rollNo}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 border-l border-border pl-8">
              <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Marks</p>
                  <p className="text-xl font-bold font-mono text-foreground">{stats.totalObtained} <span className="text-sm text-muted-foreground">/ {stats.totalMax}</span></p>
              </div>
              <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Percentage</p>
                  <div className="flex items-center gap-2">
                      <p className={`text-2xl font-bold tabular-nums ${stats.percentage >= 60 ? 'text-green-600' : stats.percentage >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {stats.percentage.toFixed(2)}%
                      </p>
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
              </div>
            </div>
            {isAdmin && (
              <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending} className="gap-2 shadow-lg shadow-primary/20">
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={handleAddBox} className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                <Plus className="w-4 h-4" />
                Add Subject / Mark Box
             </Button>
          </div>
        )}

        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="bg-muted/30 p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-heading font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Detailed Marksheet
            </h2>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Session 2025-26</div>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-100 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold border-r border-border">Subject / Test Name</th>
                  <th className="px-6 py-4 font-bold text-center border-r border-border">Obtained</th>
                  <th className="px-6 py-4 font-bold text-center border-r border-border">Full Marks</th>
                  <th className="px-6 py-4 font-bold text-right border-r border-border">Percentage</th>
                  <th className="px-6 py-4 font-bold text-right border-r border-border">Result</th>
                  {isAdmin && <th className="px-6 py-4 font-bold text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-b border-border">
                {marks.map((mark, index) => {
                  const mObtained = parseFloat(mark.obtained) || 0;
                  const mPercentage = mark.max > 0 ? (mObtained / mark.max) * 100 : 0;
                  const isPass = mPercentage >= 33;
                  const showDateHeader = index === 0 || marks[index-1].date !== mark.date;
                  
                  return (
                    <>
                      {showDateHeader && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={isAdmin ? 6 : 5} className="px-6 py-2 border-y border-border/40">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(mark.date), "MMMM d, yyyy")}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr key={mark.localId} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-6 py-3 font-semibold text-foreground border-r border-border/40">
                          {isAdmin ? (
                            <input 
                              value={mark.subject} 
                              onChange={e => handleMarkChange(index, 'subject', e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary/20 rounded px-1 outline-none transition-all hover:bg-black/5"
                              placeholder="Subject Name"
                            />
                          ) : mark.subject}
                        </td>
                        <td className="px-6 py-3 text-center font-mono font-bold text-primary border-r border-border/40">
                          {isAdmin ? (
                            <input 
                              type="number" 
                              value={mark.obtained} 
                              onChange={e => handleMarkChange(index, 'obtained', e.target.value)} 
                              className="w-20 mx-auto text-center bg-transparent border-none focus:ring-2 focus:ring-primary/20 rounded px-1 outline-none transition-all hover:bg-black/5" 
                            />
                          ) : mark.obtained}
                        </td>
                        <td className="px-6 py-3 text-center font-mono text-muted-foreground border-r border-border/40">
                           {isAdmin ? (
                             <input 
                               type="number" 
                               value={mark.max} 
                               onChange={e => handleMarkChange(index, 'max', e.target.value)} 
                               className="w-20 mx-auto text-center bg-transparent border-none focus:ring-2 focus:ring-primary/20 rounded px-1 outline-none transition-all hover:bg-black/5" 
                             />
                           ) : mark.max}
                        </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div className={cn("h-full rounded-full", isPass ? "bg-primary" : "bg-destructive")} style={{ width: `${mPercentage}%` }} />
                          </div>
                          <span className="font-bold min-w-[45px]">{mPercentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase", isPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {isPass ? "Pass" : "Fail"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveBox(index)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </td>
                      )}
                    </tr>
                  </>
                );
              })}
                <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
                  <td className="px-6 py-5 text-primary text-base">GRAND TOTAL</td>
                  <td className="px-6 py-5 text-center text-xl text-primary font-black">{stats.totalObtained}</td>
                  <td className="px-6 py-5 text-center text-lg text-muted-foreground font-mono">{stats.totalMax}</td>
                  <td className="px-6 py-5 text-right text-2xl text-primary tabular-nums" colSpan={isAdmin ? 3 : 2}>{stats.percentage.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={showLockedPopup} onOpenChange={setShowLockedPopup}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-primary">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4"><Lock className="h-8 w-8 text-primary" /></div>
            <DialogTitle className="text-2xl font-bold">Result is Locked</DialogTitle>
            <DialogDescription className="text-base pt-2">
              To view the detailed marksheet for <span className="font-bold text-foreground">{student.name}</span>, please ensure all academic dues are cleared.
            </DialogDescription>
          </DialogHeader>
        <div className="bg-muted/50 p-4 rounded-lg flex gap-3 items-start my-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground opacity-50 italic">If you have already paid, please wait for up to 24 hours for the status to update or contact the office with your receipt.</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Link href="/"><Button variant="outline" className="w-full sm:w-auto">Go Back Home</Button></Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
