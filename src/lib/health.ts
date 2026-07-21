export async function healthStatus(checkDatabase: () => Promise<unknown>) {
  try {
    await checkDatabase();
    return { status: 200, body: { status: "ok" as const } };
  } catch {
    return { status: 503, body: { status: "error" as const } };
  }
}
