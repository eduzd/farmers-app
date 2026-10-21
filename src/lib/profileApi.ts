// Saving the profile to the server, so other people see your name, photo and details.
import * as ImageManipulator from "expo-image-manipulator";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

async function call(method: string, path: string, body?: any) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Please sign in first");
  let res: Response;
  try {
    res = await fetch(new URL(path, getApiUrl()).toString(), {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("No connection. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Could not save (${res.status})`);
  return data;
}

/** A photo picked on the phone (file:// or data: URI) that still has to be uploaded. */
export function isLocalPhoto(uri?: string | null) {
  return !!uri && !uri.startsWith("/api/") && !/^https?:\/\//.test(uri);
}

/** Shrink to 512x512 JPEG and upload. Returns the photo's server path. */
export async function uploadAvatar(localUri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 512, height: 512 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) throw new Error("Could not read the picture");
  const r = await call("POST", "/api/me/avatar", { imageBase64: out.base64, mimeType: "image/jpeg" });
  return String(r.avatar);
}

export async function removeAvatar(): Promise<void> {
  await call("DELETE", "/api/me/avatar");
}

export async function saveProfileDetails(p: { name: string; phone?: string; farmingCategory?: string; role?: string }) {
  return call("PUT", "/api/me/profile", p);
}

export async function saveAbout(p: { bio?: string; location?: string }) {
  return call("PUT", "/api/me/about", { bio: p.bio || "", location: p.location || "" });
}

export async function fetchAbout(): Promise<{ bio: string; location: string } | null> {
  try {
    return await call("GET", "/api/me/about");
  } catch {
    return null;
  }
}
