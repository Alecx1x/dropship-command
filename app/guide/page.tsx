import { GuideClient } from "./guide-client";

export const metadata = {
  title: "Operating guide · Dropship Command",
};

/**
 * The owner's operating manual (in-app curriculum). The content + interactivity
 * (progress checkboxes persisted to localStorage, collapsible stages, scroll-spy
 * TOC) live in the client component; this stays a server component so it can own
 * the route metadata. Written for a technical owner new to the dropshipping
 * business itself (CLAUDE.md owner context): the full journey from standing up
 * store #1 to running a profitable multi-store portfolio.
 */
export default function GuidePage() {
  return <GuideClient />;
}
