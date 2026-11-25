import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PublicProfile = {
  slug: string;
  first_name: string | null;
  surname: string | null;
  verified: boolean;
  sections: string[];
  photo_path?: string | null;
  headline?: string | null;
  summary?: string | null;
  linkedin_url?: string | null;
  location?: { country_code: string; province_en: string | null; province_pt: string | null; district: string | null; city: string | null };
  education?: {
    institution: string | null;
    qualification_en: string;
    qualification_pt: string;
    qualification_name: string | null;
    field_en: string | null;
    field_pt: string | null;
    status: string;
    start_year: number;
    end_year: number | null;
    verified: boolean;
  }[];
  experience?: {
    organisation: string;
    role_title: string;
    type: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }[];
  skills?: { name_en: string; name_pt: string; proficiency: string }[];
  languages?: { name_en: string; name_pt: string; level: string }[];
  courses?: { title: string; badge_name: string | null; completed_at: string }[];
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A shared profile, as the database decides to show it: only enabled
 * profiles of active accounts, only the sections the student chose.
 * Works for signed-out visitors.
 */
export const getPublicProfile = cache(async (slug: string): Promise<PublicProfile | null> => {
  const s = slug.toLowerCase();
  if (s.length < 3 || s.length > 40 || !SLUG.test(s)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_profile", { p_slug: s });
  if (error) {
    console.error("public_profile failed", error.code, error.message);
    return null;
  }
  return (data as PublicProfile | null) ?? null;
});

/** Short-lived URL for the photo; storage policy allows it only while the profile shows it. */
export async function getPublicPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
