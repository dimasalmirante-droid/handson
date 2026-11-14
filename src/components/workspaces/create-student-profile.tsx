"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createStudentProfileAction, type CreateProfileState } from "@/app/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Create my student profile
    </Button>
  );
}

export function CreateStudentProfileForm() {
  const [state, action] = useActionState<CreateProfileState, FormData>(createStudentProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Checkbox id="confirm" name="confirm" required label="I want to create a student profile to find internships and first jobs." />
      <div>
        <Submit />
      </div>
    </form>
  );
}
