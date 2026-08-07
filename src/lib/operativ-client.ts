export function operationalImageUrl(imageId: string) {
  return `/api/admin/operativ-portal/billeder/${encodeURIComponent(imageId)}`;
}
