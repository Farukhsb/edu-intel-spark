import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
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

interface StoredProfileData {
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_id: string | null;
  created_at?: string;
  updated_at?: string;
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
  resendVerification: () => Promise<void>;
  enterDemo: (demoRole: AppRole) => void;
  exitDemo: () => void;
  updateRole: (newRole: AppRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const PRIMARY_PROFILE_COLLECTION = "users";
const recoveryStorageKey = (uid: string) => `gradeai-profile:${uid}`;

const normalizeProfile = (
  uid: string,
  data: Partial<StoredProfileData> | undefined,
  emailFallback: string | null,
): Profile => ({
  id: uid,
  full_name: data?.full_name ?? null,
  email: data?.email ?? emailFallback ?? null,
  role: data?.role === "lecturer" ? "lecturer" : "student",
  avatar_url: data?.avatar_url ?? null,
  cohort_id: data?.cohort_id ?? null,
  department_id: data?.department_id ?? null,
});

const persistRecoveryProfile = (uid: string, data: StoredProfileData) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(recoveryStorageKey(uid), JSON.stringify(data));
};

const readRecoveryProfile = (uid: string): StoredProfileData | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(recoveryStorageKey(uid));
    return raw ? (JSON.parse(raw) as StoredProfileData) : null;
  } catch {
    return null;
  }
};

const clearRecoveryProfile = (uid: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(recoveryStorageKey(uid));
};

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

  const pendingProfileRef = useRef<{ uid: string; data: StoredProfileData } | null>(null);

  const fetchProfileWithTimeout = async (uid: string, email: string | null): Promise<Profile | null> => {
    const deadline = Date.now() + 5000;
    let lastError: unknown = null;

    while (Date.now() < deadline) {
      try {
        const snap = await getDoc(doc(db, PRIMARY_PROFILE_COLLECTION, uid));
        if (snap.exists()) {
          const profileData = snap.data() as StoredProfileData;
          console.log(`[Auth] Profile found in '${PRIMARY_PROFILE_COLLECTION}' with role: ${profileData.role}`);
          return normalizeProfile(uid, profileData, email);
        }
      } catch (e) {
        lastError = e;
        console.warn(`[Auth] Error reading '${PRIMARY_PROFILE_COLLECTION}' for ${uid}:`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (lastError) {
      console.error("[Auth] Profile fetch failed after timeout. Last error:", lastError);
    }
    return null;
  };

  const tryWriteProfile = async (uid: string, profileData: StoredProfileData): Promise<boolean> => {
    try {
      await setDoc(
        doc(db, PRIMARY_PROFILE_COLLECTION, uid),
        {
          ...profileData,
          created_at: profileData.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
      clearRecoveryProfile(uid);
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
        setLoading(true);
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

        const pending = pendingProfileRef.current;
        if (pending && pending.uid === firebaseUser.uid) {
          pendingProfileRef.current = null;
          void tryWriteProfile(firebaseUser.uid, pending.data);
          setProfile(normalizeProfile(firebaseUser.uid, pending.data, firebaseUser.email));
          posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
          setLoading(false);
          return;
        }

        fetchProfileWithTimeout(firebaseUser.uid, firebaseUser.email).then(async (existingProfile) => {
          if (existingProfile) {
            signupProfileRef.current = null;
            clearRecoveryProfile(firebaseUser.uid);
            setProfile(existingProfile);
            posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
            setLoading(false);
            return;
          }

          const recoveredProfile = readRecoveryProfile(firebaseUser.uid);

          const fallbackProfileData: StoredProfileData = {
            full_name: recoveredProfile?.full_name ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "User",
            email: recoveredProfile?.email ?? firebaseUser.email ?? null,
            role: recoveredProfile?.role ?? "student",
            avatar_url: recoveredProfile?.avatar_url ?? null,
            cohort_id: recoveredProfile?.cohort_id ?? null,
            department_id: recoveredProfile?.department_id ?? null,
            created_at: recoveredProfile?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (!recoveredProfile) {
            console.warn("[Auth] No profile in Firestore or recovery cache for", firebaseUser.uid, "— auto-creating from Auth data");
          }

          const wrote = await tryWriteProfile(firebaseUser.uid, fallbackProfileData);
          if (!wrote) {
            pendingProfileRef.current = { uid: firebaseUser.uid, data: fallbackProfileData };
            persistRecoveryProfile(firebaseUser.uid, fallbackProfileData);
          }

          signupProfileRef.current = null;
          setProfile(normalizeProfile(firebaseUser.uid, fallbackProfileData, firebaseUser.email));
          posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
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

  const resendVerification = async () => {
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => {
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    signupProfileRef.current = { email, fullName, role, cohortId, departmentId };

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: fullName });

    try { await sendEmailVerification(cred.user); } catch {}

    const profileData: StoredProfileData = {
      full_name: fullName,
      email,
      role,
      avatar_url: null,
      cohort_id: role === "student" ? (cohortId || null) : null,
      department_id: departmentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    persistRecoveryProfile(cred.user.uid, profileData);
    const wrote = await tryWriteProfile(cred.user.uid, profileData);

    if (!wrote) {
      pendingProfileRef.current = { uid: cred.user.uid, data: profileData };
    }

    setProfile(normalizeProfile(cred.user.uid, profileData, email));
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

  const updateRole = async (newRole: AppRole) => {
    if (!user) throw new Error("Not authenticated");
    
    const uid = user.uid;
    const currentProfile = profile;
    
    // Update Firestore
    await setDoc(
      doc(db, PRIMARY_PROFILE_COLLECTION, uid),
      { role: newRole, updated_at: new Date().toISOString() },
      { merge: true },
    );
    
    // Update local recovery cache
    const recoveryData = readRecoveryProfile(uid);
    if (recoveryData) {
      persistRecoveryProfile(uid, { ...recoveryData, role: newRole });
    }
    
    // Update local state immediately
    if (currentProfile) {
      setProfile({ ...currentProfile, role: newRole });
    }
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
        resendVerification,
        enterDemo,
        exitDemo,
        updateRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
