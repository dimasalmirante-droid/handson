"use client";

import { useActionState } from "react";
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
  const actionWithCompany = updateCompanyProfile.bind(null, companyId);
  const [state, action, pending] = useActionState<CompanyProfileActionState, FormData>(actionWithCompany, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {!editable && (
        <Alert tone="info">
          You have viewer access. Contact a Company Administrator or Editor to update these details.
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="company-profile-name" label="Company name" required hint="This is the name displayed throughout your employer workspace.">
          <Input
            id="company-profile-name"
            name="name"
            defaultValue={profile.name}
            maxLength={200}
            required
            disabled={!editable || pending}
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
            disabled={!editable || pending}
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
            disabled={!editable || pending}
          />
        </Field>
        <Field id="company-profile-industry" label="Industry">
          <Select
            id="company-profile-industry"
            name="industryId"
            defaultValue={profile.industryId?.toString() ?? ""}
            disabled={!editable || pending}
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
          disabled={!editable || pending}
        />
      </Field>

      <div className="border-t border-line pt-6">
        <h2 className="mb-4 text-lg font-semibold">Location and contact</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="company-profile-country" label="Country code" hint="Two letters, for example MZ (Mozambique) or ZA (South Africa).">
            <Input
              id="company-profile-country"
              name="countryCode"
              placeholder="MZ"
              autoCapitalize="characters"
              defaultValue={profile.countryCode ?? ""}
              maxLength={2}
              disabled={!editable || pending}
            />
          </Field>
          <Field id="company-profile-province" label="Province or region">
            <Input
              id="company-profile-province"
              name="province"
              defaultValue={profile.province ?? ""}
              maxLength={100}
              disabled={!editable || pending}
            />
          </Field>
          <Field id="company-profile-city" label="City">
            <Input
              id="company-profile-city"
              name="city"
              defaultValue={profile.city ?? ""}
              maxLength={100}
              disabled={!editable || pending}
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
              disabled={!editable || pending}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <div className="text-sm text-ink-muted">
          <p>Public web address</p>
          <p className="font-mono text-ink">/{profile.slug}</p>
          <p className="mt-1">Your address is reserved and does not change when the company name changes.</p>
        </div>
        {editable && <Button type="submit" loading={pending}>Save company profile</Button>}
      </div>
    </form>
  );
}
