/**
 * Store launch playbook template (SPEC 4.3).
 *
 * The canonical checklist a new store works through before (and just after)
 * going live. Descriptions explain the WHY, because the owner is new to
 * dropshipping (CLAUDE.md owner context) — several of these (policy pages,
 * tracking, a real payment entity) are the exact things beginners skip and pay
 * for later (see GETTING_STARTED.md section C).
 *
 * Rows are instantiated per store keyed by `key`, so editing a title/description
 * here doesn't break existing stores, and adding a new item rolls out to every
 * store on next view.
 */

export interface TemplateItem {
  key: string;
  group: string;
  title: string;
  description: string;
}

/** Display order of groups on the checklist. */
export const LAUNCH_GROUPS = [
  "Foundations",
  "Trust & policies",
  "Payments & shipping",
  "Tracking & ads",
  "First products",
] as const;

export const LAUNCH_TEMPLATE: TemplateItem[] = [
  // Foundations
  {
    key: "connect-domain",
    group: "Foundations",
    title: "Connect a custom domain",
    description:
      "Buy or connect a domain in Shopify (Settings → Domains). A branded domain builds trust and is required before ad platforms will approve you.",
  },
  {
    key: "choose-theme",
    group: "Foundations",
    title: "Pick & customize a theme",
    description:
      "Start from a fast free theme (Dawn). Set your logo, colors, and a clear hero with one obvious call to action. Keep it simple and quick to load.",
  },
  // Trust & policies
  {
    key: "policy-shipping",
    group: "Trust & policies",
    title: "Shipping policy page",
    description:
      "State honest delivery estimates. Required by Google Merchant Center and the single biggest lever on chargebacks — customers dispute when shipping surprises them.",
  },
  {
    key: "policy-returns",
    group: "Trust & policies",
    title: "Returns & refunds policy",
    description:
      "A clear return window and process. Payment processors and customers both expect it; vague policies get you reserves or disputes.",
  },
  {
    key: "policy-privacy",
    group: "Trust & policies",
    title: "Privacy policy",
    description:
      "Use Shopify's generator. Legally required and needed before you can run pixels/ads.",
  },
  {
    key: "policy-terms",
    group: "Trust & policies",
    title: "Terms of service",
    description: "Standard terms — Shopify can generate a baseline you edit.",
  },
  {
    key: "contact-page",
    group: "Trust & policies",
    title: "Contact / support page",
    description:
      "A real, monitored support email and contact page. Responsive support is what keeps the chargeback rate under the threshold that gets you dropped.",
  },
  // Payments & shipping
  {
    key: "payment-provider",
    group: "Payments & shipping",
    title: "Set up a payment provider",
    description:
      "Enable Shopify Payments/Stripe and PayPal. Use a real business entity (LLC/EIN) — personal-name accounts get frozen during reviews.",
  },
  {
    key: "shipping-rates",
    group: "Payments & shipping",
    title: "Configure shipping rates",
    description:
      "Set rates or a free-shipping threshold that still protects your margin after supplier shipping cost. Don't give away shipping you can't afford.",
  },
  {
    key: "taxes",
    group: "Payments & shipping",
    title: "Set up taxes",
    description:
      "Turn on Shopify Tax. Shopify collects, but YOU remit — automate it now so it isn't a month-end scramble.",
  },
  // Tracking & ads
  {
    key: "meta-pixel",
    group: "Tracking & ads",
    title: "Install Meta pixel + Conversions API",
    description:
      "Set this up BEFORE spending. Bad/missing tracking means the algorithm is blind and you burn budget with nothing to learn from.",
  },
  {
    key: "google-tag",
    group: "Tracking & ads",
    title: "Install Google tag & purchase conversions",
    description:
      "Add GA4 + Google Ads purchase conversions with values, so ROAS is real. Verify a test purchase fires before scaling.",
  },
  {
    key: "merchant-center",
    group: "Tracking & ads",
    title: "Set up Google Merchant Center",
    description:
      "Connect via Shopify's Google & YouTube app and get the product feed approved. Google suspends merchants constantly over missing/inaccurate policy pages — do those first.",
  },
  // First products
  {
    key: "first-products",
    group: "First products",
    title: "Add your first 5 products",
    description:
      "Publish 5 tested candidates with strong images and benefit-led copy (use the AI listing generator). Quality over quantity — these are your test slate.",
  },
  {
    key: "pricing-check",
    group: "First products",
    title: "Verify pricing & margins",
    description:
      "Confirm every product clears a 3x markup after shipping. Under 3x, ad costs eat the margin — fix price or kill the product before launch.",
  },
];

export interface ProgressSummary {
  done: number;
  total: number;
  pct: number;
}

/** Compute completed/total/percentage for a set of tasks. */
export function computeProgress(tasks: { done: boolean }[]): ProgressSummary {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/** Rows for an idempotent createMany when instantiating a store's checklist. */
export function templateTaskData(storeId: string) {
  return LAUNCH_TEMPLATE.map((item, i) => ({
    storeId,
    key: item.key,
    groupName: item.group,
    title: item.title,
    description: item.description,
    sortOrder: i,
  }));
}

export interface GroupedTasks<T> {
  name: string;
  tasks: T[];
}

/**
 * Bucket tasks into groups in LAUNCH_GROUPS order, dropping empty groups.
 * Within a group, input order (sortOrder) is preserved.
 */
export function groupTasks<T extends { groupName: string }>(
  tasks: T[],
): GroupedTasks<T>[] {
  return LAUNCH_GROUPS.map((name) => ({
    name,
    tasks: tasks.filter((t) => t.groupName === name),
  })).filter((g) => g.tasks.length > 0);
}
