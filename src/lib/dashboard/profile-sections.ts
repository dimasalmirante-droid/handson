/** Sections of the student profile, each edited in its own panel (?edit=<section>). */
export const PROFILE_SECTIONS = {
  about: { title: "About you" },
  education: { title: "Education" },
  experience: { title: "Experience" },
  skills: { title: "Skills and languages" },
  preferences: { title: "What you are looking for" },
  documents: { title: "Documents and links" },
} as const;

export type ProfileSection = keyof typeof PROFILE_SECTIONS;

export function isProfileSection(value: string): value is ProfileSection {
  return Object.prototype.hasOwnProperty.call(PROFILE_SECTIONS, value);
}

/** Opens the profile with one section's edit panel. */
export function profileEditHref(section: ProfileSection): string {
  return `/dashboard/profile?edit=${section}`;
}
