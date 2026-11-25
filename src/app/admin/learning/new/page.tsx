import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { CourseForm } from "@/components/admin/course-editor";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireAdmin("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("course_categories").select("id, name").order("sort_order");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/learning" className="text-sm font-semibold text-indigo hover:underline">← All courses</Link>
      <PageHeader title="New course" lead="The course starts as a draft. Students see it only once you add lessons and publish it." />
      <Panel>
        <CourseForm categories={(data ?? []) as { id: number; name: string }[]} />
      </Panel>
    </div>
  );
}
