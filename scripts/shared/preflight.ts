const DEFAULT_TIMEOUT_MS = 3000;

type Queryable = {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
};

export async function assertDatabaseReachable(client: Queryable): Promise<void> {
  try {
    await client.$queryRawUnsafe('SELECT 1');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Database preflight failed: ${message}. Check DATABASE_URL, network access, and Neon status.`
    );
  }
}

export async function assertApiServerReachable(
  baseUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `API preflight failed for ${baseUrl}: ${message}. Start app server with "npm run dev".`
    );
  } finally {
    clearTimeout(timer);
  }
}
