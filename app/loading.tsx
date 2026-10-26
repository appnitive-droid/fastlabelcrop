import { Spinner } from "@/components/ui/primitives";

export default function Loading() {
  return <main className="container-x py-12" aria-busy="true">
    <div className="card flex items-center justify-center p-10" role="status"><Spinner label="Loading page…" /></div>
  </main>;
}
