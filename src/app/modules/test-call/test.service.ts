// src/services/call.service.ts
import { CallStatus, AgentStatus } from "@prisma/client";
import prisma from "../../utils/prisma";
import twilio from "twilio";
const VoiceResponse = twilio.twiml.VoiceResponse;

// Demo data (you can replace with database calls)
const demoSubscribers = {
  // "+18633445510": { plan: "real_agent" },
  "+19062890771": { plan: "real_agent" },
};


const demoAgents = [
  {
    name: "Alice",
    available: true,
    // sip_address: "sip:hudaisip@test-sip-sajjad.sip.twilio.com",
    sip_address: "sip:hudaisip@137.59.180.209:54723;transport=TCP;rinstance=76dda5701dee486f"
  },
  { name: "Bob", available: false, sip_address: "sip:bob@company.com" },
];

const handleIncomingCall = async (
  from: string,
  to: string,
  callSid: string
) => {
  console.log(`Incoming call from: ${from}, To: ${to}, CallSid: ${callSid}`);

  const resp = new VoiceResponse();

  try {
    // Check if subscriber exists (first try database, then demo data)
    let subscriber;

    try {
      // You might want to implement actual subscriber lookup in your database
      // For now using demo data
      subscriber = demoSubscribers[to];

      if (!subscriber) {
        // Check database if you have subscribers stored there
        // subscriber = await prisma.subscriber.findUnique({ where: { phoneNumber: to } });
      }
    } catch (dbError) {
      console.log("Database error, using demo subscribers:", dbError);
      subscriber = demoSubscribers[to];
    }

    if (!subscriber) {
      resp.say("Your number is not registered. Please contact support.");
      return resp.toString();
    }

    const plan = subscriber.plan;

    if (plan === "real_agent") {
      console.log("agent is real ");

      // Find available agent (first try database, then demo data)
      let availableAgent;

      try {
        // Try to find available agent in database
        availableAgent = await prisma.agent.findFirst({
          where: { status: AgentStatus.AVAILABLE },
        });

        if (!availableAgent) {
          // Fallback to demo data
          availableAgent = demoAgents.find((agent) => agent.available);
        }
      } catch (dbError) {
        console.log("Database error, using demo agents:", dbError);
        availableAgent = demoAgents.find((agent) => agent.available);
      }

      if (availableAgent) {
        console.log("Transferring call to real agent");

        // Update agent status to busy if it's a database agent
        // if (availableAgent.id) {
        //   try {
        //     await prisma.agent.update({
        //       where: { id: availableAgent.id },
        //       data: { status: AgentStatus.BUSY },
        //     });
        //   } catch (updateError) {
        //     console.log("Could not update agent status:", updateError);
        //   }
        // }

        // const dial = resp.dial({
        //   callerId: to,
        //   action: '/api/call/status', // Webhook for call status updates
        //   timeout: 30,
        // });

        // // Use SIP address from database or demo data
        // const sipAddress = availableAgent.sipUsername
        //   ? `sip:${availableAgent.sipUsername}@test-sip-sajjad.sip.twilio.com`
        //   : availableAgent.sip_address;

        // dial.sip(sipAddress);
      } else {
        resp.say("All agents are busy. Please try again later.");
      }
    } else {
      resp.say("Your subscription plan is invalid. Please contact support.");
    }

    return resp.toString();
  } catch (error) {
    console.error("Error processing incoming call:", error);

    // Fallback response
    resp.say(
      "We are experiencing technical difficulties. Please try again later."
    );
    return resp.toString();
  }
};

const updateCallStatus = async (
  callStatus: string,
  callSid: string,
  to: string
) => {
  // try {
  //   console.log(`Call status update: ${callStatus}, CallSid: ${callSid}`);
  //   // Extract SIP username from To field if it's a SIP call
  //   if (to && to.includes('sip:')) {
  //     const sipMatch = to.match(/sip:([^@]+)@/);
  //     if (sipMatch && sipMatch[1]) {
  //       const sipUsername = sipMatch[1];
  //       // Find the agent by SIP username
  //       let agent;
  //       try {
  //         agent = await prisma.agent.findFirst({
  //           where: { sipUsername },
  //         });
  //       } catch (dbError) {
  //         console.log("Database error finding agent:", dbError);
  //         // Try demo agents as fallback
  //         agent = demoAgents.find(a => a.sip_address.includes(sipUsername));
  //       }
  //       if (agent && agent.id) {
  //         // If call is completed or failed, set agent back to available
  //         if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
  //           try {
  //             await prisma.agent.update({
  //               where: { id: agent.id },
  //               data: { status: AgentStatus.AVAILABLE },
  //             });
  //             console.log(`Set agent ${agent.id} back to available`);
  //           } catch (updateError) {
  //             console.log("Could not update agent status:", updateError);
  //           }
  //         }
  //       }
  //     }
  //   }
  // } catch (error) {
  //   console.error("Error updating call status:", error);
  // }
};

export const TestCallService = {
  handleIncomingCall,
  updateCallStatus,
};
