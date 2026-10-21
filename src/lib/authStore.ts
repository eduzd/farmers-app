import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, saveUser, getUser, clearUser, setOnboardingComplete, isOnboardingComplete } from "./storage";
import { getApiUrl } from "./query-client";
import { useCommunityStore } from "./communityStore";
import { syncPushTokenAfterSignIn, removePushTokenFromServer } from "./notificationService";
import {
  FirebaseStep,
  firebaseCheckVerified,
  firebaseGoogleSignIn,
  firebaseResendVerification,
  firebaseSignIn,
  firebaseSignOut,
  firebaseSignUp,
  isBadCredentials,
} from "./firebaseSignIn";

const TOKEN_KEY = "auth_token";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface MembershipApplication {
  id: string;
  type: "welfare" | "summit";
  status: ApplicationStatus;
  applicationNumber: string;
  memberNumber?: string;
  appliedAt: string;
  approvedAt?: string;
  name: string;
  phone: string;
  email?: string;
  organization?: string;
  nidNumber?: string;
  photoUri?: string;
  nidUri?: string;
  paymentMethod: string;
  amount: number;
  transactionId?: string;
  paymentVerified?: boolean;
}

interface AuthConfig {
  googleAuthEnabled: boolean;
  emailVerificationEnabled: boolean;
  googleClientId: string | null;
}

/** Result of a Firebase sign-in step. firebaseError is passed to
 * firebaseErrorMessage() by the screen so it's shown in the right language. */
export interface FirebaseAuthResult {
  success: boolean;
  error?: string;
  firebaseError?: any;
  needsVerification?: boolean;
  email?: string;
}

interface SignupResult {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  email?: string;
  verificationCode?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  onboardingComplete: boolean;
  authConfig: AuthConfig | null;
  isWelfareMember: boolean;
  welfareMemberNumber: string | null;
  isSummitMember: boolean;
  summitMemberNumber: string | null;
  applications: MembershipApplication[];
  
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, communityIds?: string[]) => Promise<SignupResult>;
  verifyOtp: (email: string, code: string, password: string, name: string, username: string, communityIds?: string[]) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  loginWithGoogle: (idToken: string, accessToken?: string) => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<FirebaseAuthResult>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<FirebaseAuthResult>;
  confirmEmailVerified: () => Promise<FirebaseAuthResult>;
  resendVerificationEmail: () => Promise<FirebaseAuthResult>;
  signInWithGoogle: () => Promise<FirebaseAuthResult>;
  loginAsGuest: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUserRole: (role: User["role"]) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  loadUser: () => Promise<void>;
  loadAuthConfig: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  getToken: () => string | null;
  setWelfareMember: (isMember: boolean, memberNumber?: string) => Promise<void>;
  setSummitMember: (isMember: boolean, memberNumber?: string) => Promise<void>;
  submitApplication: (application: Omit<MembershipApplication, "id" | "status" | "appliedAt">) => Promise<string>;
  getApplicationByType: (type: "welfare" | "summit") => MembershipApplication | undefined;
  approveApplication: (applicationId: string, memberNumber: string) => Promise<void>;
}

const WELFARE_MEMBER_KEY = "welfare_member";
const WELFARE_NUMBER_KEY = "welfare_member_number";
const SUMMIT_MEMBER_KEY = "summit_member";
const SUMMIT_NUMBER_KEY = "summit_member_number";
const APPLICATIONS_KEY = "membership_applications";

/** Trade a verified Firebase ID token for the app's own session token. */
const BADGE_ROLES = ["farmer", "buyer", "company", "expert"];

/** Saves the role and farming category (the avatar badge) on the server so other people see it. */
function pushProfileBadge(token: string | null, u: User | null) {
  if (!token || !u) return;
  fetch(`${getApiUrl()}/api/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      role: BADGE_ROLES.includes(u.role) ? u.role : null,
      farmingCategory: u.farmingCategory || null,
    }),
  }).catch(() => {});
}

/** Saves the name and phone on the server (people can see who they're talking to and call them). */
function pushNamePhone(token: string | null, updates: Partial<User>) {
  if (!token || (updates.name === undefined && updates.phone === undefined)) return;
  const body: Record<string, string> = {};
  if (updates.name) body.name = updates.name;
  if (updates.phone !== undefined) body.phone = updates.phone || "";
  fetch(`${getApiUrl()}/api/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * After sign-in: bring back the badge saved on the server (a fresh sign-in rebuilds the
 * user from the server), or, for an account set up before badges were saved, send the
 * one this phone has.
 */
async function syncProfileBadge(token: string) {
  try {
    const res = await fetch(`${getApiUrl()}/api/me/profile`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const p: { role?: string | null; farmingCategory?: string | null } = await res.json();
    const { user } = useAuthStore.getState();
    if (!user) return;
    if (p.role || p.farmingCategory) {
      const merged: User = {
        ...user,
        role: (p.role && BADGE_ROLES.includes(p.role) ? p.role : user.role) as User["role"],
        farmingCategory: p.farmingCategory || user.farmingCategory,
      };
      await saveUser(merged);
      useAuthStore.setState({ user: merged });
    } else if (user.farmingCategory || BADGE_ROLES.includes(user.role)) {
      pushProfileBadge(token, user);
    }
  } catch {
    // offline: try again next sign-in
  }
}

async function exchangeFirebaseToken(
  step: FirebaseStep,
  nameHint: string | undefined,
  set: (partial: Partial<AuthState>) => void,
): Promise<FirebaseAuthResult> {
  if (step.kind === "needs_verification") {
    return { success: false, needsVerification: true, email: step.email };
  }

  const response = await fetch(`${getApiUrl()}/api/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: step.idToken, name: nameHint || step.name || undefined }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data.code === "email_not_verified") {
      return { success: false, needsVerification: true };
    }
    return { success: false, error: data.error || "Sign-in failed" };
  }

  const { token, user: apiUser, memberships, defaultCommunityId, isNewUser } = data;
  await AsyncStorage.setItem(TOKEN_KEY, token);

  const displayName: string = apiUser.name || apiUser.email.split("@")[0];
  const user: User = {
    id: apiUser.id,
    email: apiUser.email,
    name: displayName,
    initials: displayName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2),
    role: apiUser.role || "farmer",
    username: apiUser.username,
    verified: true,
    country: "BD",
    language: "en",
    avatar: apiUser.avatar,
    createdAt: apiUser.createdAt || new Date().toISOString(),
  } as User;

  await saveUser(user);
  // New accounts go through role/profile onboarding; returning ones don't.
  if (!isNewUser) await setOnboardingComplete();

  useCommunityStore.getState().setMemberships(memberships || []);
  if (defaultCommunityId) {
    useCommunityStore.getState().setActiveCommunity(defaultCommunityId);
  }

  set({
    user,
    token,
    isAuthenticated: true,
    isSuperAdmin: apiUser.isSuperAdmin || false,
    onboardingComplete: !isNewUser,
  });

  // The app session is all we need from here; drop the Firebase one.
  firebaseSignOut();

  void syncPushTokenAfterSignIn(token);
  void syncProfileBadge(token);

  return { success: true };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isSuperAdmin: false,
  onboardingComplete: false,
  authConfig: null,
  isWelfareMember: false,
  welfareMemberNumber: null,
  isSummitMember: false,
  summitMemberNumber: null,
  applications: [],

  loadAuthConfig: async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/config`);
      if (response.ok) {
        const config = await response.json();
        set({ authConfig: config });
      }
    } catch (error) {
      console.error("Failed to load auth config:", error);
    }
  },

  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      const { token, user: apiUser, memberships, defaultCommunityId } = data;

      await AsyncStorage.setItem(TOKEN_KEY, token);

      const user: User = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.name || email.split("@")[0],
        initials: (apiUser.name || email)
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2),
        role: apiUser.role || "farmer",
        username: apiUser.username,
        phone: apiUser.phone,
        location: apiUser.location,
        bio: apiUser.bio,
        verified: true,
        country: "BD",
        language: "en",
        avatar: apiUser.avatar,
        createdAt: apiUser.createdAt || new Date().toISOString(),
      } as User;

      await saveUser(user);
      // An existing account logging in has already been through onboarding;
      // don't send returning users back to the role picker every time.
      await setOnboardingComplete();

      useCommunityStore.getState().setMemberships(memberships || []);
      if (defaultCommunityId) {
        useCommunityStore.getState().setActiveCommunity(defaultCommunityId);
      }

      set({
        user,
        token,
        isAuthenticated: true,
        isSuperAdmin: apiUser.isSuperAdmin || false,
        onboardingComplete: true,
      });

      // Register this phone for push notifications
      void syncPushTokenAfterSignIn(token);
      void syncProfileBadge(token);

      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: error.message || "Login failed" };
    }
  },

  signup: async (name: string, email: string, password: string, communityIds?: string[]) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          username: email.split("@")[0],
          communityIds: communityIds || [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Signup failed" };
      }

      if (data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: data.email,
          verificationCode: data.message?.includes("Code:") ? data.message.split("Code: ")[1] : undefined,
        };
      }

      const { token, user: apiUser } = data;

      await AsyncStorage.setItem(TOKEN_KEY, token);

      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      const user: User = {
        id: apiUser.id,
        email: apiUser.email,
        name,
        initials,
        role: "farmer",
        verified: false,
        country: "BD",
        language: "en",
        createdAt: new Date().toISOString(),
      };

      await saveUser(user);

      set({
        user,
        token,
        isAuthenticated: true,
        isSuperAdmin: false,
        onboardingComplete: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Signup error:", error);
      return { success: false, error: error.message || "Signup failed" };
    }
  },

  verifyOtp: async (email: string, code: string, password: string, name: string, username: string, communityIds?: string[]) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          password,
          name,
          username,
          communityIds: communityIds || [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Verification failed" };
      }

      const { token, user: apiUser } = data;

      await AsyncStorage.setItem(TOKEN_KEY, token);

      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      const user: User = {
        id: apiUser.id,
        email: apiUser.email,
        name,
        initials,
        role: "farmer",
        verified: true,
        country: "BD",
        language: "en",
        createdAt: new Date().toISOString(),
      };

      await saveUser(user);

      set({
        user,
        token,
        isAuthenticated: true,
        isSuperAdmin: false,
        onboardingComplete: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error("OTP verification error:", error);
      return { success: false, error: error.message || "Verification failed" };
    }
  },

  resendOtp: async (email: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "signup" }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to resend code" };
      }

      return { 
        success: true,
        code: data.message?.includes("Code:") ? data.message.split("Code: ")[1] : undefined,
      };
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      return { success: false, error: error.message || "Failed to resend code" };
    }
  },

  loginWithGoogle: async (idToken: string, accessToken?: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, accessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Google login failed" };
      }

      const { token, user: apiUser, memberships, defaultCommunityId } = data;

      await AsyncStorage.setItem(TOKEN_KEY, token);

      const user: User = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.name || apiUser.email.split("@")[0],
        initials: (apiUser.name || apiUser.email).substring(0, 2).toUpperCase(),
        role: "farmer",
        verified: true,
        country: "BD",
        language: "en",
        avatar: apiUser.avatar,
        createdAt: new Date().toISOString(),
      };

      await saveUser(user);

      useCommunityStore.getState().setMemberships(memberships || []);
      if (defaultCommunityId) {
        useCommunityStore.getState().setActiveCommunity(defaultCommunityId);
      }

      set({
        user,
        token,
        isAuthenticated: true,
        isSuperAdmin: apiUser.isSuperAdmin || false,
      });

      void syncPushTokenAfterSignIn(token);
      void syncProfileBadge(token);
      return { success: true };
    } catch (error: any) {
      console.error("Google login error:", error);
      return { success: false, error: error.message || "Google login failed" };
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    let step: FirebaseStep;
    try {
      step = await firebaseSignIn(email, password);
    } catch (error: any) {
      if (isBadCredentials(error)) {
        // Accounts made before Firebase sign-in still use the old server login.
        const legacy = await get().login(email, password);
        if (legacy.success) return { success: true };
      }
      return { success: false, firebaseError: error };
    }
    try {
      return await exchangeFirebaseToken(step, undefined, set);
    } catch (error: any) {
      return { success: false, error: error?.message || "Sign-in failed" };
    }
  },

  signUpWithEmail: async (name: string, email: string, password: string) => {
    try {
      const step = await firebaseSignUp(name, email, password);
      return step.kind === "needs_verification"
        ? { success: false, needsVerification: true, email: step.email }
        : await exchangeFirebaseToken(step, name, set);
    } catch (error: any) {
      return { success: false, firebaseError: error };
    }
  },

  confirmEmailVerified: async () => {
    try {
      const step = await firebaseCheckVerified();
      if (!step) return { success: false, error: "session_expired" };
      return await exchangeFirebaseToken(step, undefined, set);
    } catch (error: any) {
      return { success: false, firebaseError: error };
    }
  },

  resendVerificationEmail: async () => {
    try {
      const sent = await firebaseResendVerification();
      return sent ? { success: true } : { success: false, error: "session_expired" };
    } catch (error: any) {
      return { success: false, firebaseError: error };
    }
  },

  signInWithGoogle: async () => {
    let step: FirebaseStep;
    try {
      step = await firebaseGoogleSignIn();
    } catch (error: any) {
      return { success: false, firebaseError: error };
    }
    try {
      return await exchangeFirebaseToken(step, undefined, set);
    } catch (error: any) {
      return { success: false, error: error?.message || "Sign-in failed" };
    }
  },

  loginAsGuest: async () => {
    const user: User = {
      id: "guest-" + Date.now().toString(),
      email: "guest@farmers.app",
      name: "Guest User",
      initials: "GU",
      role: "farmer",
      verified: false,
      country: "BD",
      language: "en",
      createdAt: new Date().toISOString(),
    };

    await saveUser(user);
    await setOnboardingComplete();
    set({ user, isAuthenticated: true, isSuperAdmin: false, onboardingComplete: true });
    // Guests have no server account, so no push token is registered.

    return true;
  },

  logout: async () => {
    await removePushTokenFromServer(get().token);
    await firebaseSignOut();
    await clearUser();
    await AsyncStorage.removeItem(TOKEN_KEY);
    useCommunityStore.getState().clearCommunityState();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isSuperAdmin: false,
      onboardingComplete: false,
    });
  },

  setUserRole: async (role: User["role"]) => {
    const { user } = get();
    if (!user) return;

    const updatedUser = { ...user, role };
    await saveUser(updatedUser);
    set({ user: updatedUser });
    pushProfileBadge(get().token, updatedUser);
  },

  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    await saveUser(updatedUser);
    set({ user: updatedUser });
    if (updates.role !== undefined || updates.farmingCategory !== undefined) {
      pushProfileBadge(get().token, updatedUser);
    }
    pushNamePhone(get().token, updates);
  },

  loadUser: async () => {
    set({ isLoading: true });

    try {
      const [user, token, onboardingDone, welfareMember, welfareNumber, summitMember, summitNumber, applicationsJson] = await Promise.all([
        getUser(),
        AsyncStorage.getItem(TOKEN_KEY),
        isOnboardingComplete(),
        AsyncStorage.getItem(WELFARE_MEMBER_KEY),
        AsyncStorage.getItem(WELFARE_NUMBER_KEY),
        AsyncStorage.getItem(SUMMIT_MEMBER_KEY),
        AsyncStorage.getItem(SUMMIT_NUMBER_KEY),
        AsyncStorage.getItem(APPLICATIONS_KEY),
      ]);

      const isWelfareMember = welfareMember ? JSON.parse(welfareMember) : false;
      const isSummitMember = summitMember ? JSON.parse(summitMember) : false;
      const applications: MembershipApplication[] = applicationsJson ? JSON.parse(applicationsJson) : [];

      get().loadAuthConfig();

      if (user && token) {
        try {
          const response = await fetch(`${getApiUrl()}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            useCommunityStore.getState().setMemberships(data.memberships || []);
            if (data.defaultCommunityId) {
              useCommunityStore.getState().setActiveCommunity(data.defaultCommunityId);
            }

            set({
              user,
              token,
              isAuthenticated: true,
              isSuperAdmin: data.user?.isSuperAdmin || false,
              onboardingComplete: onboardingDone,
              isLoading: false,
              isWelfareMember,
              welfareMemberNumber: welfareNumber,
              isSummitMember,
              summitMemberNumber: summitNumber,
              applications,
            });
            void syncPushTokenAfterSignIn(token);
            void syncProfileBadge(token);
            return;
          }
        } catch (e) {
          console.log("Failed to verify token, using cached user");
        }
      }

      set({
        user,
        token,
        isAuthenticated: !!user,
        isSuperAdmin: false,
        onboardingComplete: onboardingDone,
        isLoading: false,
        isWelfareMember,
        welfareMemberNumber: welfareNumber,
        isSummitMember,
        summitMemberNumber: summitNumber,
        applications,
      });
    } catch (error) {
      console.error("Load user error:", error);
      set({ isLoading: false });
    }
  },

  completeOnboarding: async () => {
    await setOnboardingComplete();
    set({ onboardingComplete: true });
  },

  getToken: () => {
    return get().token;
  },

  setWelfareMember: async (isMember: boolean, memberNumber?: string) => {
    try {
      await AsyncStorage.setItem(WELFARE_MEMBER_KEY, JSON.stringify(isMember));
      if (memberNumber) {
        await AsyncStorage.setItem(WELFARE_NUMBER_KEY, memberNumber);
      }
      set({ isWelfareMember: isMember, welfareMemberNumber: memberNumber || null });
    } catch (error) {
      console.error("Failed to save welfare member status:", error);
    }
  },

  setSummitMember: async (isMember: boolean, memberNumber?: string) => {
    try {
      await AsyncStorage.setItem(SUMMIT_MEMBER_KEY, JSON.stringify(isMember));
      if (memberNumber) {
        await AsyncStorage.setItem(SUMMIT_NUMBER_KEY, memberNumber);
      }
      set({ isSummitMember: isMember, summitMemberNumber: memberNumber || null });
    } catch (error) {
      console.error("Failed to save summit member status:", error);
    }
  },

  submitApplication: async (applicationData) => {
    try {
      const id = `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const newApplication: MembershipApplication = {
        ...applicationData,
        id,
        status: "pending",
        appliedAt: new Date().toISOString(),
        paymentVerified: false,
      };

      const currentApplications = get().applications;
      const updatedApplications = [...currentApplications, newApplication];

      await AsyncStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updatedApplications));
      set({ applications: updatedApplications });

      return id;
    } catch (error) {
      console.error("Failed to submit application:", error);
      throw error;
    }
  },

  getApplicationByType: (type) => {
    const { applications } = get();
    return applications.find((app) => app.type === type);
  },

  approveApplication: async (applicationId: string, memberNumber: string) => {
    try {
      const currentApplications = get().applications;
      const user = get().user;
      const updatedApplications = currentApplications.map((app) => {
        if (app.id === applicationId) {
          return {
            ...app,
            status: "approved" as ApplicationStatus,
            memberNumber,
            approvedAt: new Date().toISOString(),
          };
        }
        return app;
      });

      await AsyncStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updatedApplications));

      const approvedApp = updatedApplications.find((app) => app.id === applicationId);
      if (approvedApp) {
        if (approvedApp.type === "welfare") {
          await get().setWelfareMember(true, memberNumber);
        } else if (approvedApp.type === "summit") {
          await get().setSummitMember(true, memberNumber);
        }

      }

      set({ applications: updatedApplications });
    } catch (error) {
      console.error("Failed to approve application:", error);
      throw error;
    }
  },
}));
