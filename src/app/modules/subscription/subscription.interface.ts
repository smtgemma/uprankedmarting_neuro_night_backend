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

