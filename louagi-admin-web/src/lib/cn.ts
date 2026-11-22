import clsx, { type ClassValue } from "clsx";

// Tiny className combiner. (No tailwind-merge — we don't generate conflicting
// utility sets in this app, so clsx is enough and keeps the dep surface small.)
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
