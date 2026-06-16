import { getLaunchPlaybook } from "@/lib/playbook/data";
import { LaunchChecklist } from "./checklist";

export const dynamic = "force-dynamic";

export default async function LaunchPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { groups, progress } = await getLaunchPlaybook(storeId);

  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Work top to bottom to take this store live. Each step explains why it
        matters — the trust, payments, and tracking items are the ones beginners
        skip and pay for later.
      </p>
      <LaunchChecklist storeId={storeId} groups={groups} progress={progress} />
    </div>
  );
}
