import Stripe from "stripe";
import config from "../config";

export const stripe = new Stripe(config.stripe.secret_key!, {
  apiVersion: "2025-07-30.basil",
  typescript: true,
});