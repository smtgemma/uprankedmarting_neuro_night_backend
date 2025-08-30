import { Router } from "express";
import { PlanRoutes } from "../modules/plan/plan.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.routes";
import { SubscriptionRoutes } from "../modules/subscription/subscription.route";
import {  CallRoutes } from "../modules/calls/calls.route";
import { ServiceFeedbackRoutes } from "../modules/feedback/ServiceFeedback/serviceFeedback.route";
import { AgentFeedbackRoutes } from "../modules/feedback/AgentFeedback/agentFeedback.route";
import { TwilioPhoneNumberRoutes } from "../modules/availableNumbers/availableNumbers.routes";
import { AgentRoutes } from "../modules/agentManagement/agent.routes";
import { TestCallRoutes } from "../modules/test-call/test.route";
import { CompanyDocRoutes } from "../modules/companyDoc/companyDoc.routes";
import { RecordAndTranscriptRoutes } from "../modules/RecordAndTranscript/recordAndTranscript.routes";
import { SipRoutes } from "../modules/sip/sip.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/plans",
    route: PlanRoutes,
  },
  {
    path: "/subscriptions",
    route: SubscriptionRoutes,
  },
  {
    path: "/calls",
    route: TestCallRoutes,
  },
  {
    path: "/service-feedback",
    route: ServiceFeedbackRoutes,
  },
  {
    path: "/agent-feedback",
    route: AgentFeedbackRoutes,
  },
  {
    path: "/call",
    route: CallRoutes,
  },
  {
    path: "/active-numbers",
    route: TwilioPhoneNumberRoutes,
  },
  {
    path: "/agents",
    route: AgentRoutes,
  },
  {
    path: "/company-docs",
    route: CompanyDocRoutes,
  },
  {
    path: "/call-logs",
    route: RecordAndTranscriptRoutes,
  },
  {
    path: "/sip",
    route: SipRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
