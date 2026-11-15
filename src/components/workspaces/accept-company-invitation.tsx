"use client";

import { useActionState } from "react";
import { acceptCompanyInvitation } from "@/app/invite/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export function AcceptCompanyInvitationForm() {
  const [state, action, pending] = useActionState(acceptCompanyInvitation, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <p className="text-sm text-ink-muted">
        By accepting, you join this employer&apos;s workspace as its Company Administrator. Access is granted to this Handson account only.
      </p>
      <Button type="submit" loading={pending}>Accept invitation</Button>
    </form>
  );
}
