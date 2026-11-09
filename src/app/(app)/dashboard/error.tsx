"use client";

import { ErrorState } from "@/components/layout/states";

export default function SectionError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} home="/dashboard" />;
}
