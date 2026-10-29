import { Suspense } from "react";
import { ClientsWorkspace } from "@/components/clients/clients-workspace";

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsWorkspace />
    </Suspense>
  );
}
