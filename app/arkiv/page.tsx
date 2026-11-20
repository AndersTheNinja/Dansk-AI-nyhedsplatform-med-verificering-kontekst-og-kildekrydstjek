import { redirect } from "next/navigation";

// Preserve old bookmarks without publishing a separate archive.
export default function RemovedArchive() {
  redirect("/");
}
