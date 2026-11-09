import type { Metadata } from "next";
import { Overview } from "@/components/dashboard/overview";
import { Alert } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import {
  getCompletion,
  getDocuments,
  getEducation,
  getExperiences,
  getNotifications,
  getPhotoUrl,
  getProfile,
  getSkills,
} from "@/lib/data/student";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverview({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const [profile, completion, education, experiences, skills, documents, notifications, catalogues, sp] = await Promise.all([
    getProfile(user.id),
    getCompletion(user.id),
    getEducation(user.id),
    getExperiences(user.id),
    getSkills(user.id),
    getDocuments(user.id),
    getNotifications(user.id),
    getCatalogues(),
    searchParams,
  ]);
  if (!profile) return <Alert tone="danger">Your profile could not be loaded. Please refresh the page.</Alert>;
  const photoUrl = await getPhotoUrl(profile.photo_path);

  return (
    <Overview
      profile={profile}
      photoUrl={photoUrl}
      completion={completion}
      education={education}
      experiences={experiences}
      skills={skills}
      documents={documents}
      notifications={notifications}
      catalogues={catalogues}
      notice={typeof sp.notice === "string" ? sp.notice : undefined}
    />
  );
}
