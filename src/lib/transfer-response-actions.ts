"use server";

import { redirect } from "next/navigation";
import { acceptTransferAction, rejectTransferAction, type ActionState } from "./actions";

export async function acceptTransferAndRefreshAction(
  state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await acceptTransferAction(state, formData);
  if (result.ok) {
    redirect(`/brandmand/anmodninger/${String(formData.get("transferId") ?? "")}`);
  }
  return result;
}

export async function rejectTransferAndRefreshAction(
  state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await rejectTransferAction(state, formData);
  if (result.ok) {
    redirect(`/brandmand/anmodninger/${String(formData.get("transferId") ?? "")}`);
  }
  return result;
}
