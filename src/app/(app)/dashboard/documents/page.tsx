import { redirect } from "next/navigation";
import { profileEditHref } from "@/lib/dashboard/profile-sections";

/** Moved: this section is now edited from My profile. Kept so existing links keep working. */
export default function MovedDocumentsPage() {
  redirect(profileEditHref("documents"));
}
