const KNOWN_BRANDS: Readonly<Record<string, string>> = {
  adobe: 'adobe.com',
  airbnb: 'airbnb.com',
  amazon: 'amazon.com',
  anthropic: 'anthropic.com',
  apple: 'apple.com',
  asana: 'asana.com',
  atlassian: 'atlassian.com',
  brex: 'brex.com',
  coinbase: 'coinbase.com',
  databricks: 'databricks.com',
  datadog: 'datadoghq.com',
  discord: 'discord.com',
  doordash: 'doordash.com',
  dropbox: 'dropbox.com',
  duckduckgo: 'duckduckgo.com',
  figma: 'figma.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  google: 'google.com',
  hubspot: 'hubspot.com',
  huggingface: 'huggingface.co',
  instacart: 'instacart.com',
  intuit: 'intuit.com',
  klarna: 'klarna.com',
  linear: 'linear.app',
  linkedin: 'linkedin.com',
  lyft: 'lyft.com',
  mercury: 'mercury.com',
  meta: 'meta.com',
  microsoft: 'microsoft.com',
  modal: 'modal.com',
  mongodb: 'mongodb.com',
  netflix: 'netflix.com',
  nvidia: 'nvidia.com',
  notion: 'notion.so',
  openai: 'openai.com',
  oracle: 'oracle.com',
  palantir: 'palantir.com',
  paypal: 'paypal.com',
  perplexity: 'perplexity.ai',
  pinterest: 'pinterest.com',
  plaid: 'plaid.com',
  posthog: 'posthog.com',
  ramp: 'ramp.com',
  reddit: 'reddit.com',
  replit: 'replit.com',
  retool: 'retool.com',
  rippling: 'rippling.com',
  robinhood: 'robinhood.com',
  salesforce: 'salesforce.com',
  scale: 'scale.com',
  scaleai: 'scale.com',
  shopify: 'shopify.com',
  slack: 'slack.com',
  snowflake: 'snowflake.com',
  spacex: 'spacex.com',
  spotify: 'spotify.com',
  square: 'squareup.com',
  stripe: 'stripe.com',
  supabase: 'supabase.com',
  tesla: 'tesla.com',
  tiktok: 'tiktok.com',
  twilio: 'twilio.com',
  uber: 'uber.com',
  uncooked: 'uncooked.com',
  vercel: 'vercel.com',
  wealthfront: 'wealthfront.com',
  x: 'x.com',
  zendesk: 'zendesk.com',
  zoom: 'zoom.us',
}

function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32)
}

export function resolveCompanyDomain(name: string, explicitWebsite: string | null | undefined): string | null {
  if (explicitWebsite) {
    try {
      const parsed = new URL(
        explicitWebsite.startsWith('http') ? explicitWebsite : `https://${explicitWebsite}`,
      )
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return explicitWebsite
    }
  }

  const slug = slugifyCompanyName(name)
  if (!slug) return null
  return KNOWN_BRANDS[slug] ?? `${slug}.com`
}
