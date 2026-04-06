import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
  profileError: string | null;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const signupProfileRef = useRef<{
    email: string;
    fullName: string;
    role: AppRole;
    cohortId?: string;
    departmentId?: string;
  } | null>(null);

  const fetchProfileWithTimeout = async (uid: string, email: string | null): Promise<Profile | null> => {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      try {
        const snap = await getDoc(doc(db, "profiles", uid));

        if (snap.exists()) {
          const data = snap.data();
          return {
            id: snap.id,
            full_name: data.full_name || null,
            email: data.email || email || null,
            role: data.role || "student",
            avatar_url: data.avatar_url || null,
            cohort_id: data.cohort_id || null,
            department_id: data.department_id || null,
          };
        }
      } catch {
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return null;
  };
  // Pending profile data to write on auth state change if Firestore write failed during signup
  const pendingProfileRef = useRef<{ uid: string; data: any; role: AppRole } | null>(null);

  const tryWriteProfile = async (uid: string, profileData: any, role: AppRole): Promise<boolean> => {
    try {
      await setDoc(doc(db, "profiles", uid), profileData);
      await setDoc(doc(db, "user_roles", uid), { user_id: uid, role });
      return true;
    } catch (e) {
      console.error("Firestore profile write failed:", e);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfileError(null);

        const signupProfile = signupProfileRef.current;
        if (signupProfile && signupProfile.email === firebaseUser.email) {
          setProfile({
            id: firebaseUser.uid,
            full_name: signupProfile.fullName,
            email: firebaseUser.email,
            role: signupProfile.role,
            avatar_url: null,
            cohort_id: signupProfile.role === "student" ? (signupProfile.cohortId || null) : null,
            department_id: signupProfile.departmentId || null,
          });
          posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
          setLoading(false);
          return;
        }

        // If we have pending profile data from a failed signup write, retry it
        const pending = pendingProfileRef.current;
        if (pending && pending.uid === firebaseUser.uid) {
          pendingProfileRef.current = null;
          tryWriteProfile(firebaseUser.uid, pending.data, pending.role).then(() => {
            // Set profile from pending data regardless of Firestore success
            setProfile({
              id: firebaseUser.uid,
              full_name: pending.data.full_name,
              email: pending.data.email,
              role: pending.role,
              avatar_url: null,
              cohort_id: pending.data.cohort_id,
              department_id: pending.data.department_id,
            });
            posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
            setLoading(false);
          });
          return;
        }

        fetchProfileWithTimeout(firebaseUser.uid, firebaseUser.email).then(async (p) => {
          if (p) {
            signupProfileRef.current = null;
            setProfile(p);
            posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
          } else {
            // Profile doesn't exist — maybe Firestore write failed during signup
            // Try to create a basic profile from Firebase Auth data
            const displayName = firebaseUser.displayName;
            if (displayName) {
              const fallbackData = {
                full_name: displayName,
                email: firebaseUser.email,
                role: "student" as AppRole,
                avatar_url: null,
                cohort_id: null,
                department_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              const wrote = await tryWriteProfile(firebaseUser.uid, fallbackData, "student");
              if (wrote) {
                setProfile({
                  id: firebaseUser.uid,
                  full_name: displayName,
                  email: firebaseUser.email,
                  role: "student",
                  avatar_url: null,
                  cohort_id: null,
                  department_id: null,
                });
                posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
                setLoading(false);
                return;
              }
            }
            setProfileError("Something went wrong loading your account. Please try again.");
          }
          setLoading(false);
        });
      } else if (!isDemo) {
        signupProfileRef.current = null;
        pendingProfileRef.current = null;
        setProfile(null);
        setProfileError(null);
        posthog.reset();
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isDemo]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => {
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    signupProfileRef.current = { email, fullName, role, cohortId, departmentId };

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    
    // Save displayName to Firebase Auth
    await updateProfile(cred.user, { displayName: fullName });

    const profileData = {
      full_name: fullName,
      email,
      role,
      avatar_url: null,
      cohort_id: role === "student" ? (cohortId || null) : null,
      department_id: departmentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try writing to Firestore, but don't fail signup if it errors
    const wrote = await tryWriteProfile(cred.user.uid, profileData, role);

    if (!wrote) {
      // Store pending data so onAuthStateChanged can retry
      pendingProfileRef.current = { uid: cred.user.uid, data: profileData, role };
    }

    // Set profile in state immediately regardless
    setProfile({
      id: cred.user.uid,
      full_name: fullName,
      email,
      role,
      avatar_url: null,
      cohort_id: role === "student" ? (cohortId || null) : null,
      department_id: departmentId || null,
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleSignOut = async () => {
    if (isDemo) {
      setIsDemo(false);
      setProfile(null);
      signupProfileRef.current = null;
      pendingProfileRef.current = null;
      return;
    }
    await firebaseSignOut(auth);
    signupProfileRef.current = null;
    pendingProfileRef.current = null;
    setProfile(null);
    setProfileError(null);
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
    signupProfileRef.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        user: isDemo ? ({ uid: profile?.id, email: profile?.email } as any) : user,
        profile,
        role: profile?.role ?? null,
        loading,
        profileError,
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
