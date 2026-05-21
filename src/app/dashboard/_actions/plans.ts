"use server";

import {
  listPlans as fetchPlans,
  getCurrentPlanForBusiness as fetchCurrent,
  type Plan,
} from "@/lib/plans";

export async function listPlans(): Promise<Plan[]> {
  return fetchPlans();
}

export async function getCurrentPlanForBusiness(
  businessId: string,
): Promise<Plan | null> {
  return fetchCurrent(businessId);
}
