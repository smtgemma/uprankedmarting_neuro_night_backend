import { Interval, Plan, PlanLevel } from "@prisma/client";
import prisma from "../../utils/prisma";
import { stripe } from "../../utils/stripe";

type ExtraAgentPricing = { agents: number; price: number }[];

interface PlanCreateInput {
  planName: string;
  description?: string;
  amount: number;
  currency?: string;
  interval?: Interval;
  intervalCount?: number;
  planLevel: PlanLevel;
  freeTrialDays?: number;
  active?: boolean;
  extraAgentPricing?: ExtraAgentPricing;
  features?: any;
}

const createPlan = async (payload: PlanCreateInput): Promise<Plan> => {
  return await prisma.$transaction(async (tx) => {
    const {
      planName,
      description,
      amount,
      interval = Interval.month,
      intervalCount = 1,
      planLevel,
      freeTrialDays = 0,
      active = true,
      extraAgentPricing = [],
    } = payload;

    // Auto-set defaults
    const defaultAgentsMap: Record<PlanLevel, number> = {
      [PlanLevel.only_real_agent]: 2,
      [PlanLevel.ai_then_real_agent]: 2,
      [PlanLevel.only_ai]: 0,
    };

    const minuteLimitMap: Record<PlanLevel, number> = {
      [PlanLevel.only_real_agent]: 900,
      [PlanLevel.only_ai]: 800,
      [PlanLevel.ai_then_real_agent]: 1000,
    };

    const defaultAgents = defaultAgentsMap[planLevel];
    const totalMinuteLimit = minuteLimitMap[planLevel];

    // Convert pricing to cents
    const formattedExtraPricing = extraAgentPricing.map((item) => ({
      agents: item.agents,
      price: Math.round(item.price * 100),
    }));

    // Stripe: Product
    const product = await stripe.products.create({
      name: planName,
      description: description || undefined,
      active,
      metadata: {
        planLevel,
        defaultAgents: defaultAgents.toString(),
        totalMinuteLimit: totalMinuteLimit.toString(),
      },
    });

    // Stripe: Price
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: Math.round(amount * 100),
      recurring: { interval, interval_count: intervalCount },
      product: product.id,
    });

    // DB: Save Plan
    return await tx.plan.create({
      data: {
        planName,
        amount,
        currency: "usd",
        interval,
        intervalCount,
        freeTrialDays,
        productId: product.id,
        priceId: price.id,
        active,
        description,
        planLevel,
        defaultAgents,
        extraAgentPricing: formattedExtraPricing,
        totalMinuteLimit,
        features: payload.features || {},
      },
    });
  });
};

const getAllPlans = async () => {
  return await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
  });
};

const getPlanById = async (planId: string): Promise<Plan> => {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");
  return plan;
};

const updatePlan = async (
  planId: string,
  payload: Partial<Omit<PlanCreateInput, "planLevel">> & {
    planLevel?: PlanLevel;
  }
) => {
  return await prisma.$transaction(async (tx) => {
    const existingPlan = await tx.plan.findUnique({ where: { id: planId } });
    if (!existingPlan) throw new Error("Plan not found");

    const updateData: any = { ...payload };

    // Recompute defaults if planLevel changes
    if (payload.planLevel) {
      const defaultAgentsMap: Record<PlanLevel, number> = {
        [PlanLevel.only_real_agent]: 2,
        [PlanLevel.ai_then_real_agent]: 2,
        [PlanLevel.only_ai]: 0,
      };
      const minuteLimitMap: Record<PlanLevel, number> = {
        [PlanLevel.only_real_agent]: 900,
        [PlanLevel.only_ai]: 800,
        [PlanLevel.ai_then_real_agent]: 1000,
      };

      updateData.defaultAgents = defaultAgentsMap[payload.planLevel];
      updateData.totalMinuteLimit = minuteLimitMap[payload.planLevel];
    }

    // Format extra pricing
    if (payload.extraAgentPricing) {
      updateData.extraAgentPricing = payload.extraAgentPricing.map((item) => ({
        agents: item.agents,
        price: Math.round(item.price * 100),
      }));
    }

    // Update Stripe Product
    if (payload.planName || payload.description !== undefined) {
      await stripe.products.update(existingPlan.productId, {
        name: payload.planName || existingPlan.planName,
        description:
          payload.description ?? existingPlan.description ?? undefined,
      });
    }

    // Update Stripe Price
    if (payload.amount !== undefined) {
      await stripe.prices.update(existingPlan.priceId, { active: false });
      const newPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: Math.round(payload.amount * 100),
        recurring: {
          interval: existingPlan.interval,
          interval_count: existingPlan.intervalCount,
        },
        product: existingPlan.productId,
      });
      updateData.priceId = newPrice.id;
    }

    return await tx.plan.update({
      where: { id: planId },
      data: updateData,
    });
  });
};

const deletePlan = async (planId: string) => {
  return await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plan not found");

    await stripe.prices.update(plan.priceId, { active: false });
    await stripe.products.update(plan.productId, { active: false });

    await tx.plan.delete({ where: { id: planId } });

    return { message: "Plan deleted and archived in Stripe" };
  });
};

export const PlanServices = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
