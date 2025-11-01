// modules/plan/plan.interface.ts
export interface ICreatePlanRequest {
  name: string;
  description?: string;
  price: number;
  interval: "MONTH" | "YEAR";
  trialDays?: number;
  features?: string[]; // ← Array of strings
  planLevel: "only_real_agent" | "only_ai" | "ai_then_real_agent";
  defaultAgents?: number;
  extraAgentPricing?: Array<{ agents: number; price: number }>;
  totalMinuteLimit?: number;
}

export interface IUpdatePlanRequest {
  name?: string;
  description?: string;
  price?: number;
  interval?: "MONTH" | "YEAR";
  trialDays?: number;
  isActive?: boolean;
  features?: string[]; // ← Array of strings
  planLevel?: "only_real_agent" | "only_ai" | "ai_then_real_agent";
  defaultAgents?: number;
  extraAgentPricing?: Array<{ agents: number; price: number }>;
  totalMinuteLimit?: number;
}