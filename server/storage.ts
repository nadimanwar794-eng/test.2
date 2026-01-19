import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  runTransaction 
} from "firebase/firestore";
import {
  type Student,
  type Subject,
  type Mark,
  type StudentWithMarks,
  type Admin,
  type Session,
  type Class
} from "@shared/schema";

export interface IStorage {
  // Students
  getStudents(): Promise<StudentWithMarks[]>;
  getStudent(id: number): Promise<StudentWithMarks | undefined>;
  createStudent(student: Student): Promise<Student>;
  updateStudent(id: number, update: Partial<Student>): Promise<Student>;
  deleteStudent(id: number): Promise<void>;
  
  // Subjects
  getSubjects(): Promise<Subject[]>;
  createSubject(subject: Subject): Promise<Subject>;
  updateSubject(id: number, subject: Partial<Subject>): Promise<Subject>;
  deleteSubject(id: number): Promise<void>;
  
  // Marks
  updateMark(studentId: number, subjectId: number, obtained: string): Promise<Mark>;
  deleteMark(id: number): Promise<void>;

  // Auth & Admin
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  getAdmin(id: number): Promise<Admin | undefined>;
  createAdmin(admin: Admin): Promise<Admin>;

  // Sessions
  getSessions(): Promise<Session[]>;
  createSession(session: Session): Promise<Session>;
  deleteSession(id: number): Promise<void>;

  // Classes
  getClasses(sessionId?: number): Promise<Class[]>;
  createClass(cls: Class): Promise<Class>;
  deleteClass(id: number): Promise<void>;
}

async function getNextId(collectionName: string): Promise<number> {
  const counterRef = doc(db, "counters", collectionName);
  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let count = 1;
      if (counterDoc.exists()) {
        count = counterDoc.data().count + 1;
      }
      transaction.set(counterRef, { count });
      return count;
    });
  } catch (e) {
    console.error(`Failed to get next ID for ${collectionName}:`, e);
    throw e;
  }
}

export class FirebaseStorage implements IStorage {
  async getStudents(): Promise<StudentWithMarks[]> {
    try {
      const studentsSnap = await getDocs(collection(db, "students"));
      const allStudents = studentsSnap.docs.map(d => d.data() as Student);
      
      const marksSnap = await getDocs(collection(db, "marks"));
      const allMarks = marksSnap.docs.map(d => d.data() as Mark);
      
      const subjectsSnap = await getDocs(collection(db, "subjects"));
      const allSubjects = subjectsSnap.docs.map(d => d.data() as Subject);

      return allStudents.map(s => {
        const studentMarks = allMarks
          .filter(m => m.studentId === s.id)
          .map(m => {
            const subject = allSubjects.find(sub => sub.id === m.subjectId);
            return {
              ...m,
              subject: subject || { id: 0, name: "Unknown", date: "", maxMarks: 100, classId: 0 }
            };
          });
        return { ...s, marks: studentMarks };
      });
    } catch (error) {
      console.error("Error in getStudents:", error);
      return [];
    }
  }

  async getStudent(id: number): Promise<StudentWithMarks | undefined> {
    // Firestore queries need index for non-ID fields if large, but 'where' works fine for small datasets
    // Since we store custom numeric ID, we query by field 'id'
    const q = query(collection(db, "students"), where("id", "==", id));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    
    const student = snap.docs[0].data() as Student;

    const subjectsSnap = await getDocs(collection(db, "subjects"));
    const allSubjects = subjectsSnap.docs.map(d => d.data() as Subject);

    const marksQ = query(collection(db, "marks"), where("studentId", "==", id));
    const marksSnap = await getDocs(marksQ);
    
    const studentMarks = marksSnap.docs.map(d => {
      const m = d.data() as Mark;
      return {
        ...m,
        subject: allSubjects.find(sub => sub.id === m.subjectId)!
      };
    });

    return { ...student, marks: studentMarks };
  }

  async createStudent(insertStudent: Student): Promise<Student> {
    const id = await getNextId("students");
    const student: Student = { ...insertStudent, id };
    await setDoc(doc(db, "students", id.toString()), student);

    // Auto-create marks for existing subjects in this class
    const subjectsSnap = await getDocs(collection(db, "subjects"));
    const allSubjects = subjectsSnap.docs.map(d => d.data() as Subject);
    const classSubjects = allSubjects.filter(sub => sub.classId === insertStudent.classId);

    if (classSubjects.length > 0) {
      const markPromises = classSubjects.map(async (sub) => {
        const markId = await getNextId("marks");
        const mark: Mark = {
          id: markId,
          studentId: id,
          subjectId: sub.id,
          obtained: "0"
        };
        return setDoc(doc(db, "marks", markId.toString()), mark);
      });
      await Promise.all(markPromises);
    }

    return student;
  }

  async updateStudent(id: number, update: Partial<Student>): Promise<Student> {
    const q = query(collection(db, "students"), where("id", "==", id));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Student not found");
    
    const docRef = snap.docs[0].ref;
    await updateDoc(docRef, update);
    
    const updated = await getDoc(docRef);
    return updated.data() as Student;
  }

  async deleteStudent(id: number): Promise<void> {
    // Delete marks
    const marksQ = query(collection(db, "marks"), where("studentId", "==", id));
    const marksSnap = await getDocs(marksQ);
    const deleteMarksPromises = marksSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deleteMarksPromises);

    // Delete student
    const q = query(collection(db, "students"), where("id", "==", id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
  }

  async getSubjects(): Promise<Subject[]> {
    const snap = await getDocs(collection(db, "subjects"));
    return snap.docs.map(d => d.data() as Subject);
  }

  async createSubject(insertSubject: Subject): Promise<Subject> {
    const id = await getNextId("subjects");
    const subject: Subject = { ...insertSubject, id };
    await setDoc(doc(db, "subjects", id.toString()), subject);

    // Auto-create "0" marks
    const studentsSnap = await getDocs(collection(db, "students"));
    const allStudents = studentsSnap.docs.map(d => d.data() as Student);
    
    if (allStudents.length > 0) {
      const batchPromises = allStudents.map(async (s) => {
        const markId = await getNextId("marks");
        const mark: Mark = {
          id: markId,
          studentId: s.id,
          subjectId: id,
          obtained: "0"
        };
        return setDoc(doc(db, "marks", markId.toString()), mark);
      });
      await Promise.all(batchPromises);
    }

    return subject;
  }

  async updateSubject(id: number, update: Partial<Subject>): Promise<Subject> {
    const q = query(collection(db, "subjects"), where("id", "==", id));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Subject not found");
    
    // If maxMarks is changed, we don't automatically change existing marks 
    // but the UI will calculate percentages based on the new maxMarks.
    await updateDoc(snap.docs[0].ref, update);
    const updated = await getDoc(snap.docs[0].ref);
    return updated.data() as Subject;
  }

  async deleteSubject(id: number): Promise<void> {
    const marksQ = query(collection(db, "marks"), where("subjectId", "==", id));
    const marksSnap = await getDocs(marksQ);
    const deleteMarksPromises = marksSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deleteMarksPromises);

    const q = query(collection(db, "subjects"), where("id", "==", id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const q = query(collection(db, "settings"), where("key", "==", key));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data().value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const q = query(collection(db, "settings"), where("key", "==", key));
    const snap = await getDocs(q);
    if (snap.empty) {
      const docRef = doc(collection(db, "settings"));
      await setDoc(docRef, { id: Math.floor(Math.random() * 1000000), key, value });
    } else {
      await updateDoc(snap.docs[0].ref, { value });
    }
  }

  async updateMark(studentId: number, subjectId: number, obtained: string): Promise<Mark> {
    const q = query(
      collection(db, "marks"), 
      where("studentId", "==", studentId), 
      where("subjectId", "==", subjectId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      await updateDoc(docRef, { obtained: obtained.toString() });
      const updated = await getDoc(docRef);
      return { ...updated.data() } as Mark;
    } else {
      const id = await getNextId("marks");
      const mark: Mark = {
        id,
        studentId,
        subjectId,
        obtained: obtained.toString()
      };
      await setDoc(doc(db, "marks", id.toString()), mark);
      return mark;
    }
  }

  async deleteMark(id: number): Promise<void> {
    const q = query(collection(db, "marks"), where("id", "==", id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
  }

  // Admin Methods
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const q = query(collection(db, "admins"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Admin;
  }

  async getAdmin(id: number): Promise<Admin | undefined> {
    const q = query(collection(db, "admins"), where("id", "==", id));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Admin;
  }

  async createAdmin(insertAdmin: Admin): Promise<Admin> {
    const id = await getNextId("admins");
    const admin: Admin = { ...insertAdmin, id, isSuperAdmin: false };
    await setDoc(doc(db, "admins", id.toString()), admin);
    return admin;
  }

  // Session Methods
  async getSessions(): Promise<Session[]> {
    const snap = await getDocs(collection(db, "sessions"));
    return snap.docs.map(d => d.data() as Session);
  }

  async createSession(insertSession: Session): Promise<Session> {
    const id = await getNextId("sessions");
    const session: Session = { ...insertSession, id };
    await setDoc(doc(db, "sessions", id.toString()), session);
    return session;
  }

  async deleteSession(id: number): Promise<void> {
    const classes = await this.getClasses(id);
    for (const cls of classes) {
      await this.deleteClass(cls.id);
    }
    const q = query(collection(db, "sessions"), where("id", "==", id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
  }

  // Class Methods
  async getClasses(sessionId?: number): Promise<Class[]> {
    let q;
    if (sessionId !== undefined) {
      q = query(collection(db, "classes"), where("sessionId", "==", sessionId));
    } else {
      q = query(collection(db, "classes"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Class);
  }

  async createClass(insertClass: Class): Promise<Class> {
    const id = await getNextId("classes");
    const cls: Class = { ...insertClass, id };
    await setDoc(doc(db, "classes", id.toString()), cls);
    return cls;
  }

  async deleteClass(id: number): Promise<void> {
    const studentsQ = query(collection(db, "students"), where("classId", "==", id));
    const studentsSnap = await getDocs(studentsQ);
    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data() as Student;
      await this.deleteStudent(student.id);
    }

    const subjectsQ = query(collection(db, "subjects"), where("classId", "==", id));
    const subjectsSnap = await getDocs(subjectsQ);
    for (const subjectDoc of subjectsSnap.docs) {
      const subject = subjectDoc.data() as Subject;
      await this.deleteSubject(subject.id);
    }

    const q = query(collection(db, "classes"), where("id", "==", id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
    }
  }
}

export const storage = new FirebaseStorage();
