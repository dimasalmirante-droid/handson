"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { updateCompanyProfile, type CompanyProfileActionState } from "@/app/employer/[companyId]/profile/actions";

export type CompanyProfileValues = {
  name: string;
  slug: string;
  contactEmail: string | null;
  description: string | null;
  website: string | null;
  industryId: number | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  businessPhone: string | null;
};

export type IndustryOption = { id: number; name: string };

export function CompanyProfileForm({
  companyId,
  profile,
  industries,
  editable,
}: {
  companyId: string;
  profile: CompanyProfileValues;
  industries: IndustryOption[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const industryName = industries.find((industry) => industry.id === profile.industryId)?.name ?? null;

  const handleSaved = useCallback((message: string) => {
    setSaveNotice(message);
    setEditing(false);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {saveNotice && <Alert tone="success">{saveNotice}</Alert>}

      {editing ? (
        <CompanyProfileEditor
          companyId={companyId}
          profile={profile}
          industries={industries}
          onCancel={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">{profile.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">Organisation details</p>
            </div>
            {editable && (
              <Button onClick={() => setEditing(true)} className="shrink-0">
                Edit company profile
              </Button>
            )}
          </div>

          <section aria-labelledby="company-profile-organisation-heading">
            <h3 id="company-profile-organisation-heading" className="mb-5 text-lg font-semibold">
              Organisation details
            </h3>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <ProfileDetail
                label="Official contact email"
                value={profile.contactEmail ? (
                  <a className="font-medium text-indigo hover:underline" href={`mailto:${profile.contactEmail}`}>
                    {profile.contactEmail}
                  </a>
                ) : null}
              />
              <ProfileDetail
                label="Company website"
                value={profile.website ? (
                  <a className="break-all font-medium text-indigo hover:underline" href={profile.website} target="_blank" rel="noreferrer">
                    {profile.website}
                  </a>
                ) : null}
              />
              <ProfileDetail label="Industry" value={industryName} />
              <div className="sm:col-span-2">
                <ProfileDetail
                  label="About the company"
                  value={profile.description ? (
                    <p className="whitespace-pre-wrap break-words">{profile.description}</p>
                  ) : null}
                />
              </div>
            </dl>
          </section>

          <section className="border-t border-line pt-6" aria-labelledby="company-profile-location-heading">
            <h3 id="company-profile-location-heading" className="mb-5 text-lg font-semibold">
              Location and contact
            </h3>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <ProfileDetail label="Country code" value={profile.countryCode} />
              <ProfileDetail label="Province or region" value={profile.province} />
              <ProfileDetail label="City" value={profile.city} />
              <ProfileDetail
                label="Business phone"
                value={profile.businessPhone ? (
                  <a className="font-medium text-indigo hover:underline" href={`tel:${profile.businessPhone}`}>
                    {profile.businessPhone}
                  </a>
                ) : null}
              />
            </dl>
          </section>

          <div className="flex flex-col gap-2 border-t border-line pt-5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p>Permanent public web address</p>
              <p className="mt-1 font-mono text-ink">/{profile.slug}</p>
              <p className="mt-1">This address is reserved and does not change when the company name changes.</p>
            </div>
            {!editable && (
              <Alert tone="info" className="sm:max-w-sm">
                You have Reviewer access. Contact a Company Administrator to update these details.
              </Alert>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CompanyProfileEditor({
  companyId,
  profile,
  industries,
  onCancel,
  onSaved,
}: {
  companyId: string;
  profile: CompanyProfileValues;
  industries: IndustryOption[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const actionWithCompany = updateCompanyProfile.bind(null, companyId);
  const [state, action, pending] = useActionState<CompanyProfileActionState, FormData>(actionWithCompany, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onSaved(state.message ?? "Company profile updated successfully.");
    }
  }, [state, onSaved, router]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Edit company profile</h2>
        <p className="mt-1 text-sm text-ink-muted">Update the details Handson uses inside your employer workspace.</p>
      </div>

      {state?.message && !state.ok && <Alert tone="danger">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="company-profile-name" label="Company name" required hint="This is the name displayed throughout your employer workspace.">
          <Input
            id="company-profile-name"
            name="name"
            defaultValue={profile.name}
            maxLength={200}
            required
            disabled={pending}
          />
        </Field>
        <Field
          id="company-profile-contact-email"
          label="Official contact email"
          hint="Use a shared company address, such as your HR or recruitment inbox. This is not a sign-in account."
        >
          <Input
            id="company-profile-contact-email"
            name="contactEmail"
            type="email"
            autoComplete="email"
            defaultValue={profile.contactEmail ?? ""}
            maxLength={320}
            disabled={pending}
          />
        </Field>
        <Field id="company-profile-website" label="Company website" hint="Enter the full HTTPS address, for example https://example.com.">
          <Input
            id="company-profile-website"
            name="website"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={profile.website ?? ""}
            maxLength={300}
            disabled={pending}
          />
        </Field>
        <Field id="company-profile-industry" label="Industry">
          <Select
            id="company-profile-industry"
            name="industryId"
            defaultValue={profile.industryId?.toString() ?? ""}
            disabled={pending}
          >
            <option value="">Select an industry</option>
            {industries.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}
          </Select>
        </Field>
      </div>

      <Field
        id="company-profile-description"
        label="About the company"
        hint="A short introduction to your organisation. This stays inside the workspace for now and is not published automatically."
      >
        <Textarea
          id="company-profile-description"
          name="description"
          defaultValue={profile.description ?? ""}
          maxLength={2000}
          className="min-h-36"
          disabled={pending}
        />
      </Field>

      <div className="border-t border-line pt-6">
        <h3 className="mb-4 text-lg font-semibold">Location and contact</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="company-profile-country" label="Country code" hint="Two letters, for example MZ (Mozambique) or ZA (South Africa).">
            <Input
              id="company-profile-country"
              name="countryCode"
              placeholder="MZ"
              autoCapitalize="characters"
              defaultValue={profile.countryCode ?? ""}
              maxLength={2}
              disabled={pending}
            />
          </Field>
          <Field id="company-profile-province" label="Province or region">
            <Input
              id="company-profile-province"
              name="province"
              defaultValue={profile.province ?? ""}
              maxLength={100}
              disabled={pending}
            />
          </Field>
          <Field id="company-profile-city" label="City">
            <Input
              id="company-profile-city"
              name="city"
              defaultValue={profile.city ?? ""}
              maxLength={100}
              disabled={pending}
            />
          </Field>
          <Field id="company-profile-phone" label="Business phone" hint="Include the country code, with no spaces, for example +258841234567.">
            <Input
              id="company-profile-phone"
              name="businessPhone"
              type="tel"
              inputMode="tel"
              placeholder="+258841234567"
              defaultValue={profile.businessPhone ?? ""}
              maxLength={16}
              disabled={pending}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-ink-muted">
          <p>Permanent public web address</p>
          <p className="mt-1 font-mono text-ink">/{profile.slug}</p>
          <p className="mt-1">This address is reserved and does not change when the company name changes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

function ProfileDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-[15px] leading-6 text-ink">
        {value ?? <span className="text-ink-muted">Not added</span>}
      </dd>
    </div>
  );
}
