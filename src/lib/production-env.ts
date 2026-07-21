export function validateProductionEnvironment(env: NodeJS.ProcessEnv) {
  const required = ["DATABASE_URL", "AUTH_SECRET", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  const missing = required.filter((key) => !env[key]);

  if (env.NODE_ENV === "production" && missing.length > 0) {
    return {
      ok: false,
      missing
    };
  }

  return {
    ok: true,
    missing: []
  };
}
