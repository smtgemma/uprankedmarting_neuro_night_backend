export interface ICreateSubscriptionRequest {
  planId: string;
  paymentMethodId: string;
  purchasedNumber?: string;
  sid?: string;
  extraAgents?: number;
}

export interface ICancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}

// modules/subscription/subscription.interface.ts
export interface ISwitchPlanRequest {
  newPlanId: string;
  extraAgents?: number; // optional – keep current if not sent
}