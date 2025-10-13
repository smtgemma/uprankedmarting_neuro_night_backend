import { Router } from "express";
import { PlanRoutes } from "../modules/plan/plan.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.routes";
import { SubscriptionRoutes } from "../modules/subscription/subscription.route";
import { CallRoutes } from "../modules/calls/calls.route";
import { ServiceFeedbackRoutes } from "../modules/feedback/ServiceFeedback/serviceFeedback.route";
import { AgentFeedbackRoutes } from "../modules/feedback/AgentFeedback/agentFeedback.route";
import { TwilioPhoneNumberRoutes } from "../modules/availableNumbers/availableNumbers.routes";
import { TestCallRoutes } from "../modules/test-call/test.route";
import { CompanyDocRoutes } from "../modules/companyDoc/companyDoc.routes";
import { RecordAndTranscriptRoutes } from "../modules/RecordAndTranscript/recordAndTranscript.routes";
import { SipRoutes } from "../modules/sip/sip.route";
import { OrganizationRoutes } from "../modules/organization/organization.routes";
import { AssignmentRoutes } from "../modules/agentManagement/agent.routes";
import { ToolsRoutes } from "../modules/tools/tools.route";
import { ClientManagementRoutes } from "../modules/clientManagement/clientManagement.routes";
import { DashboardStatsRoutes } from "../modules/dashboardStats/dashboardStats.route";
import { ContactRoutes } from "../modules/contact/contact.route";
import { PhoneNumberRequestRoutes } from "../modules/PhoneNumberRequest/PhoneNumberRequest.route";

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
    route: AssignmentRoutes,
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
  {
    path: "/organizations",
    route: OrganizationRoutes,
  },
  {
    path: "/tools",
    route: ToolsRoutes,
  },
  {
    path: "/organization-admins",
    route: ClientManagementRoutes,
  },
  {
    path: "/dashboard",
    route: DashboardStatsRoutes,
  },
  {
    path: "/contact",
    route: ContactRoutes,
  },
  {
    path: "/number-request",
    route: PhoneNumberRequestRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
