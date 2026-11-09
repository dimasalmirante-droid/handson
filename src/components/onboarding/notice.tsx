import { Alert } from "@/components/ui/feedback";

const NOTICES: Record<string, { title: string; body?: string }> = {
  verified: { title: "Email verified", body: "Your account is active. Let's build your profile." },
  "password-updated": { title: "Your password has been updated." },
};

export function PageNotice({ notice }: { notice: string | string[] | undefined }) {
  const n = typeof notice === "string" ? NOTICES[notice] : undefined;
  if (!n) return null;
  return (
    <Alert tone="success" className="mb-8" title={n.title}>
      {n.body}
    </Alert>
  );
}
