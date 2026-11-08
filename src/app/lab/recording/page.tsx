import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecordingCheck from "@/components/recording/RecordingCheckLoader";
import { canOpenLab, parseLabUserIds } from "@/domain/lab-access";
import { getCurrentUser } from "@/lib/auth";

async function isLabUser(): Promise<boolean> {
  const user = await getCurrentUser();
  return canOpenLab(user?.id ?? null, parseLabUserIds(process.env.LAB_USER_IDS));
}

// Next streams a page's metadata even when the page answers 404, so a static title would name the page to
// everyone it is hidden from.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await isLabUser())) return {};
  return { title: "녹음 점검 · Plypick", robots: { index: false, follow: false } };
}

export default async function RecordingCheckPage() {
  if (!(await isLabUser())) notFound();

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-12">
      <h1 className="text-h2 font-bold text-text">녹음 점검</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-text-muted">
        합주실 믹서의 USB 소리가 이 폰과 브라우저에서 녹음되는지 확인해요. 녹음은 이 폰 안에만 있고 어디에도 올리지 않아요.
      </p>
      <RecordingCheck />
    </main>
  );
}
