import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { posthog } from "@/lib/posthog";

type AppRole = "lecturer" | "student";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_id: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isDemo: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterDemo: (demoRole: AppRole) => void;
  exitDemo: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const DEMO_LECTURER_PROFILE: Profile = {
  id: "demo-lecturer",
  full_name: "Dr. Demo Lecturer",
  email: "demo@gradeai.com",
  role: "lecturer",
  avatar_url: null,
  cohort_id: null,
  department_id: null,
};

const DEMO_STUDENT_PROFILE: Profile = {
  id: "demo-student",
  full_name: "Demo Student",
  email: "student@gradeai.com",
  role: "student",
  avatar_url: null,
  cohort_id: "200",
  department_id: "Computer Science",
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchProfile = async (uid: string) => {
    const snap = await getDoc(doc(db, "profiles", uid));
    if (snap.exists()) {
      const data = snap.data();
      setProfile({
        id: snap.id,
        full_name: data.full_name || null,
        email: data.email || null,
        role: data.role || "student",
        avatar_url: data.avatar_url || null,
        cohort_id: data.cohort_id || null,
        department_id: data.department_id || null,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
        posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
      } else if (!isDemo) {
        setProfile(null);
        posthog.reset();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemo]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => {
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: fullName });

    await setDoc(doc(db, "profiles", cred.user.uid), {
      full_name: fullName,
      email,
      role,
      avatar_url: null,
      cohort_id: role === "student" ? (cohortId || null) : null,
      department_id: departmentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await setDoc(doc(db, "user_roles", cred.user.uid), {
      user_id: cred.user.uid,
      role,
    });

    await fetchProfile(cred.user.uid);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleSignOut = async () => {
    if (isDemo) {
      setIsDemo(false);
      setProfile(null);
      return;
    }
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const enterDemo = (demoRole: AppRole) => {
    setIsDemo(true);
    setProfile(demoRole === "lecturer" ? DEMO_LECTURER_PROFILE : DEMO_STUDENT_PROFILE);
    setLoading(false);
  };

  const exitDemo = () => {
    setIsDemo(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: isDemo ? ({ uid: profile?.id, email: profile?.email } as any) : user,
        profile,
        role: profile?.role ?? null,
        loading,
        isDemo,
        signUp,
        signIn,
        signOut: handleSignOut,
        resetPassword,
        enterDemo,
        exitDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
