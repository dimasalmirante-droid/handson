"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyRole } from "@/lib/auth/company";
import { createClient } from "@/lib/supabase/server";
import { companyProfileSchema } from "@/lib/companies/profile-validation";

export type CompanyProfileActionState = { ok?: boolean; message?: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateCompanyProfile(
  companyId: string,
  _previous: CompanyProfileActionState,
  formData: FormData,
): Promise<CompanyProfileActionState> {
  if (!UUID.test(companyId)) return { ok: false, message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");

  const parsed = companyProfileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    description: String(formData.get("description") ?? ""),
    website: String(formData.get("website") ?? ""),
    industryId: String(formData.get("industryId") ?? ""),
    countryCode: String(formData.get("countryCode") ?? ""),
    province: String(formData.get("province") ?? ""),
    city: String(formData.get("city") ?? ""),
    businessPhone: String(formData.get("businessPhone") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the company details and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("company_update_profile", {
    p_company: companyId,
    p_name: parsed.data.name,
    p_contact_email: parsed.data.contactEmail,
    p_description: parsed.data.description,
    p_website: parsed.data.website,
    p_industry_id: parsed.data.industryId,
    p_country_code: parsed.data.countryCode,
    p_province: parsed.data.province,
    p_city: parsed.data.city,
    p_business_phone: parsed.data.businessPhone,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, message: "You do not have permission to edit this company profile." };
    if (error.code === "22023" || error.code === "P0002") return { ok: false, message: error.message };
    console.error("company profile update failed", error.code);
    return { ok: false, message: "The company profile could not be saved. Please try again." };
  }

  revalidatePath(`/employer/${companyId}`);
  revalidatePath(`/employer/${companyId}/profile`);
  return { ok: true, message: "Company profile updated successfully." };
}
