import { redirect } from "next/navigation";

// The dashboard group's layout guards auth and bounces unauthenticated users
// to /login, so the root simply points at the first dashboard screen.
export default function Home() {
  redirect("/overview");
}
