import { redirect } from "next/navigation";

export default function DocsRoot() {
  redirect("/dashboard/docs/install");
}
