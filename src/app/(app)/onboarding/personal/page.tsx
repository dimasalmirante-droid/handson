import type { Metadata } from "next";
import { PageNotice } from "@/components/onboarding/notice";
import { PersonalForm } from "@/components/onboarding/personal-form";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireUser } from "@/lib/auth/session";
import { countryOptions, splitPhone } from "@/lib/countries";
import { getCatalogues } from "@/lib/data/catalogues";
import { getPhotoUrl, getProfile } from "@/lib/data/student";
import { PhotoUploader } from "@/components/files/photo-uploader";

export const metadata: Metadata = { title: "Personal information" };

export default async function PersonalStep({ searchParams }: PageProps<"/onboarding/personal">) {
  const user = await requireUser("/onboarding/personal");
  const [profile, catalogues, sp] = await Promise.all([getProfile(user.id), getCatalogues(), searchParams]);
  const phone = splitPhone(profile?.phone);
  const photoUrl = await getPhotoUrl(profile?.photo_path ?? null);
  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.surname?.[0] ?? ""}`.toUpperCase() || "?";

  const initial: Record<string, string> = {
    firstName: profile?.first_name ?? "",
    middleName: profile?.middle_name ?? "",
    surname: profile?.surname ?? "",
    dateOfBirth: profile?.date_of_birth ?? "",
    gender: profile?.gender ?? "",
    nationality: profile?.nationality_code ?? "",
    country: profile?.country_code ?? "MZ",
    provinceId: profile?.province_id ? String(profile.province_id) : "",
    city: profile?.city ?? "",
    phoneDial: phone.dial,
    phoneNumber: phone.national,
    linkedinUrl: profile?.linkedin_url ?? "",
  };

  return (
    <>
      <PageNotice notice={sp.notice} />
      <StepHeader
        step={1}
        title="Personal information"
        lead="The basics employers need to know who you are and how to reach you. Fields marked * are required."
      />
      <PersonalForm photo={<PhotoUploader photoUrl={photoUrl} initials={initials} />} initial={initial} countries={countryOptions("en")} provinces={catalogues.provinces} />
    </>
  );
}
