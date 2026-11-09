import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { PhotoUploader } from "@/components/files/photo-uploader";
import { InterestsStep } from "@/components/onboarding/interests-step";
import { PersonalForm } from "@/components/onboarding/personal-form";
import { requireUser } from "@/lib/auth/session";
import { countryOptions, splitPhone } from "@/lib/countries";
import { getCatalogues } from "@/lib/data/catalogues";
import { getInterests, getPhotoUrl, getProfile } from "@/lib/data/student";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser("/dashboard/profile");
  const [profile, interests, catalogues] = await Promise.all([getProfile(user.id), getInterests(user.id), getCatalogues()]);
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
      <PageHeader title="My profile" lead="Your personal details and what you are looking for. Changes save automatically." />
      <div className="flex flex-col gap-6">
        <Panel title="Personal information">
          <PersonalForm
            embedded
            photo={<PhotoUploader photoUrl={photoUrl} initials={initials} />}
            initial={initial}
            countries={countryOptions("en")}
            provinces={catalogues.provinces}
          />
        </Panel>
        <Panel title="Professional interests" id="interests">
          <InterestsStep
            embedded
            initial={interests}
            industries={catalogues.industries}
            jobFunctions={catalogues.jobFunctions}
            provinces={catalogues.provinces}
          />
        </Panel>
      </div>
    </>
  );
}
