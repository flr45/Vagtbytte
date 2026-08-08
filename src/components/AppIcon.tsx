import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "home"
  | "alarm"
  | "swap"
  | "settings"
  | "truck"
  | "more"
  | "menu"
  | "back"
  | "chevronRight"
  | "edit"
  | "user"
  | "users"
  | "bell"
  | "history"
  | "phone"
  | "logout"
  | "status"
  | "document"
  | "video"
  | "book"
  | "qr"
  | "star"
  | "activity"
  | "chart"
  | "archive"
  | "database"
  | "mail"
  | "warning"
  | "checkCircle"
  | "clock";

export function AppIcon({ name, ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<AppIconName, ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></>,
    alarm: <><path d="M9 3h6"/><path d="M10 6h4"/><path d="M7.2 10.2a5 5 0 0 1 9.6 0L19 18H5l2.2-7.8Z"/><path d="M9.5 21h5"/><path d="M4 7 2.5 5.5"/><path d="M20 7l1.5-1.5"/></>,
    swap: <><path d="M4 7h14"/><path d="m15 4 3 3-3 3"/><path d="M20 17H6"/><path d="m9 14-3 3 3 3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    truck: <><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M6 9h5M8.5 6v6"/></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
    chevronRight: <><path d="m9 18 6-6-6-6"/></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/><path d="M16.5 15a5 5 0 0 1 4 5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/></>,
    phone: <><rect x="6.5" y="2" width="11" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
    logout: <><path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/></>,
    status: <><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></>,
    document: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/><path d="m9 9 4 3-4 3z"/></>,
    book: <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 8H12v12H7.5A3.5 3.5 0 0 0 4 23.5z" transform="translate(0 -2)"/><path d="M20 4.5A3.5 3.5 0 0 0 16.5 8H12v12h4.5a3.5 3.5 0 0 1 3.5 3.5z" transform="translate(0 -2)"/></>,
    qr: <><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><path d="M15 15h2v2h-2zM19 15h2M19 19h2v2h-2M15 19v2h2"/></>,
    star: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    archive: <><path d="M4 7h16v13H4z"/><path d="M3 3h18v4H3z"/><path d="M9 11h6"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>
  };

  return <svg {...common} {...props}>{paths[name]}</svg>;
}
