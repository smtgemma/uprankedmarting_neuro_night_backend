import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import { stripe } from "../../utils/stripe";
import { ICreatePlanRequest, IUpdatePlanRequest } from "./plan.interface";

const createPlan = async (payload: ICreatePlanRequest) => {
  try {
    // 1. Create Stripe Product
    const product = await stripe.products.create({
      name: payload.name,
      description: payload.description,
      metadata: {
        planLevel: payload.planLevel,
        defaultAgents: payload.defaultAgents?.toString() || "0",
      },
    });

    // 2. Create Stripe Price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(payload.price * 100),
      currency: "usd",
      recurring: {
        interval: payload.interval.toLowerCase() as "month" | "year",
        trial_period_days: payload.trialDays,
      },
    });

    // 3. Save to DB
    return await prisma.plan.create({
      data: {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        interval: payload.interval,
        trialDays: payload.trialDays || 1,
        stripePriceId: price.id,
        stripeProductId: product.id,
        features: payload.features || {},
        planLevel: payload.planLevel,
        defaultAgents: payload.defaultAgents || 0,
        extraAgentPricing: payload.extraAgentPricing || [],
        totalMinuteLimit: payload.totalMinuteLimit || 0,
      },
    });
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to create plan: ${error.message}`
    );
  }
};

const getAllPlans = async (filters?: {
  isActive?: boolean;
  isDeleted?: boolean;
}) => {
  const where: any = { isDeleted: false };
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return await prisma.plan.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
};

const getPlanById = async (id: string) => {
  const plan = await prisma.plan.findUnique({
    where: { id, isDeleted: false },
    include: { subscriptions: { where: { status: "ACTIVE" } } },
  });

  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found");

  return plan;
};

const updatePlan = async (id: string, payload: IUpdatePlanRequest) => {
  const plan = await prisma.plan.findUnique({
    where: { id, isDeleted: false },
    include: { subscriptions: true },
  });

  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found");

  const hasActiveSubs = plan.subscriptions.some((s) => s.status === "ACTIVE");

  // Block price/trial changes if active subs
  if (hasActiveSubs) {
    if (payload.price !== undefined && payload.price !== plan.price) {
      throw new AppError(
        status.BAD_REQUEST,
        "Cannot change price on active subscriptions"
      );
    }
    if (
      payload.trialDays !== undefined &&
      payload.trialDays !== plan.trialDays
    ) {
      throw new AppError(
        status.BAD_REQUEST,
        "Cannot change trial days on active subscriptions"
      );
    }
  }

  try {
    let newPriceId = plan.stripePriceId;

    // Update Stripe Product
    if (payload.name || payload.description) {
      await stripe.products.update(plan.stripeProductId, {
        name: payload.name || plan.name,
        description: payload.description ?? plan.description,
      });
    }

    // Create new price if price or interval changed
    if (payload.price !== undefined || payload.interval !== undefined) {
      await stripe.prices.update(plan.stripePriceId, { active: false });

      const newPrice = await stripe.prices.create({
        product: plan.stripeProductId,
        unit_amount: Math.round((payload.price || plan.price) * 100),
        currency: "usd",
        recurring: {
          interval: (payload.interval || plan.interval).toLowerCase() as
            | "month"
            | "year",
          trial_period_days: payload.trialDays || plan.trialDays,
        },
      });
      newPriceId = newPrice.id;
    }

    // Update DB
    return await prisma.plan.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        interval: payload.interval,
        trialDays: payload.trialDays,
        stripePriceId: newPriceId,
        isActive: payload.isActive,
        features: payload.features,
        planLevel: payload.planLevel,
        defaultAgents: payload.defaultAgents,
        extraAgentPricing: payload.extraAgentPricing,
        totalMinuteLimit: payload.totalMinuteLimit,
      },
    });
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Update failed: ${error.message}`
    );
  }
};

const deletePlan = async (id: string) => {
  const plan = await prisma.plan.findUnique({
    where: { id, isDeleted: false },
    include: {
      subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
    },
  });

  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found");
  if (plan.subscriptions.length > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot delete plan with active subscriptions"
    );
  }

  try {
    await stripe.products.update(plan.stripeProductId, { active: false });
    await prisma.plan.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });

    return { message: "Plan archived successfully" };
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Delete failed: ${error.message}`
    );
  }
};

export const PlanService = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
