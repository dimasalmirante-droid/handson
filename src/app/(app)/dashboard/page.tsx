import type { Metadata } from "next";
import { Overview } from "@/components/dashboard/overview";
import { Alert } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getCatalogue } from "@/lib/data/learning";
import { suggestedCourse } from "@/lib/learning/model";
import {
  getCompletion,
  getDocuments,
  getEducation,
  getNotifications,
  getPhotoUrl,
  getProfile,
} from "@/lib/data/student";
import { T } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dashboard") };
}

export default async function DashboardOverview({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireStudent("/dashboard");
  const [profile, completion, education, documents, notifications, catalogues, courses, sp] = await Promise.all([
    getProfile(user.id),
    getCompletion(user.id),
    getEducation(user.id),
    getDocuments(user.id),
    getNotifications(user.id),
    getCatalogues(),
    getCatalogue(),
    searchParams,
  ]);
  const locale = await getLocale();
  if (!profile) return <Alert tone="danger"><T>{"Your profile could not be loaded. Please refresh the page."}</T></Alert>;
  const photoUrl = await getPhotoUrl(profile.photo_path);

  return (
    <Overview
      profile={profile}
      photoUrl={photoUrl}
      completion={completion}
      education={education}
      documents={documents}
      notifications={notifications}
      catalogues={catalogues}
      notice={typeof sp.notice === "string" ? sp.notice : undefined}
      locale={locale}
      course={suggestedCourse(courses)}
    />
  );
}
