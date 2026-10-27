import { Alert } from "react-native";
import type { PublicUser } from "@/lib/storage";
import { currentUserId } from "@/lib/api";
import { tr } from "@/lib/tr";

/** What a screen knows about a person when someone taps their photo or name. */
export interface ProfilePerson {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  initials?: string | null;
  avatar?: string | null;
  avatarId?: string | null;
  avatarColor?: string | null;
  /** "farmer" | "buyer" | "company" | "expert" (profile_role or sign-up role) */
  role?: string | null;
  profileRole?: string | null;
  farmingCategory?: string | null;
  verified?: boolean | null;
  isWelfareMember?: boolean | null;
  bio?: string | null;
  location?: string | null;
  isFollowing?: boolean | null;
}

const ROLES = ["farmer", "buyer", "company", "expert"] as const;

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/**
 * The params for the UserProfile screen. Carries the photo along, so the page shows it at once;
 * the page then reads the person's public card from the server and shows the newest photo and name.
 * Never invents a location, bio or numbers.
 */
export function profileParam(p: ProfilePerson): PublicUser {
  const name = String(p.name || p.username || "").trim();
  const roleRaw = String(p.profileRole || p.role || "");
  const role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as PublicUser["role"]) : "farmer";
  return {
    id: String(p.id || ""),
    name,
    username: p.username || undefined,
    initials: p.initials || initialsFrom(name),
    role,
    farmingCategory: p.farmingCategory || undefined,
    avatar: p.avatar || undefined,
    avatarId: p.avatarId || undefined,
    avatarColor: p.avatarColor || undefined,
    verified: !!p.verified,
    isWelfareMember: !!p.isWelfareMember,
    bio: p.bio || "",
    location: p.location || "",
    followersCount: 0,
    followingCount: 0,
    isFollowing: !!p.isFollowing,
  };
}

/** An id that belongs to a real account (not a made-up sample person or a phone-only post). */
export function isAccountId(id?: string | null): id is string {
  if (!id) return false;
  const s = String(id);
  return !s.startsWith("user-") && !s.startsWith("local-") && !s.startsWith("sample-");
}

/**
 * Opens that person's profile page. Your own photo or name opens your Profile tab.
 * The profile is pushed on top (also from one profile to another, or from a chat), so Back returns
 * to where the tap happened and a profile opened earlier is never reused with someone else's details.
 * Returns false when there is no account to show.
 */
export function openUserProfile(navigation: any, p: ProfilePerson): boolean {
  if (!isAccountId(p.id)) {
    Alert.alert(tr("Profile"), tr("This person isn't on Farmers yet, so there's no profile to show."));
    return false;
  }
  if (p.id === currentUserId()) {
    navigation.navigate("Main", { screen: "Profile" });
    return true;
  }
  const params = { user: profileParam(p) };
  if (typeof navigation.push === "function") navigation.push("UserProfile", params);
  else navigation.navigate("UserProfile", params);
  return true;
}
