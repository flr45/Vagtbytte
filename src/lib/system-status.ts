export function isWorkerStale(lastActiveAt: Date | null, now = new Date(), maxAgeMinutes = 2) {
  if (!lastActiveAt) {
    return true;
  }
  return now.getTime() - lastActiveAt.getTime() > maxAgeMinutes * 60 * 1000;
}

export function isWebPushConfigured(env: NodeJS.ProcessEnv) {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}
