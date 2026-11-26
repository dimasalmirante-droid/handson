"use client";

import { useActionState } from "react";
import { acceptCompanyInvitation } from "@/app/invite/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { T, useT } from "@/i18n/client";
import type { CompanyRole } from "@/lib/auth/destination";

export function AcceptCompanyInvitationForm({ role }: { role: CompanyRole }) {
  const [state, action, pending] = useActionState(acceptCompanyInvitation, {});
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">
          {role === "company_admin"
            ? t("By accepting, you join this employer's workspace as a Company Administrator. Access is granted to this Handson account only.")
            : t("By accepting, you join this employer's workspace as a Reviewer. Access is granted to this Handson account only.")}
        </p>
        <p className="text-sm text-ink-muted">
          {role === "company_admin"
            ? t("Company Administrators can manage company details and invite or manage colleagues.")
            : t("Reviewers can view company workspace information. They cannot edit company details or manage team access.")}
        </p>
      </div>
      <Button type="submit" loading={pending}><T>{"Accept invitation"}</T></Button>
    </form>
  );
}
