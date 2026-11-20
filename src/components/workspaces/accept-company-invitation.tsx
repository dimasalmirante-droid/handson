"use client";

import { useActionState } from "react";
import { acceptCompanyInvitation } from "@/app/invite/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { T } from "@/i18n/client";

export function AcceptCompanyInvitationForm() {
  const [state, action, pending] = useActionState(acceptCompanyInvitation, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <p className="text-sm text-ink-muted">
        <T>{"By accepting, you join this employer's workspace as its Company Administrator. Access is granted to this Handson account only."}</T>
      </p>
      <Button type="submit" loading={pending}><T>{"Accept invitation"}</T></Button>
    </form>
  );
}
