import { Polar } from "@polar-sh/sdk";

let client: Polar | null = null;

/**
 * Lazily-created Polar client. Uses sandbox mode automatically unless
 * POLAR_ENVIRONMENT=production is explicitly set — this makes sandbox
 * the safe default while testing, and production requires an explicit
 * opt-in rather than an accidental one.
 */
export function getPolar(): Polar {
  if (client) return client;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured on the server.");
  }

  const server = process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";

  client = new Polar({
    accessToken,
    server,
  });
  return client;
}
