import { CallStatus } from "../../config/constants";
import prisma from "../../utils/prisma";

export const CallService = {
  async handleIncomingCall(callControlId: string, from: string, to: string) {
    try {
      // // 1. Immediately answer the call
      // await TelnyxService.answerCall(callControlId);
      
      // // 2. Record the call in database
      // await prisma.call.create({
      //   data: {
      //     callControlId,
      //     fromNumber: from,
      //     toNumber: to,
      //     status: CallStatus.ANSWERED,
      //   },
      // });

      // // 3. Play ringing audio (20 seconds loop)
      // await TelnyxService.playAudio(
      //   callControlId,
      //   "https://assets.ctfassets.net/4xqgylk9emz6/2XHj1Qb3i2QqZ5QkZ5Q5Q5/2f8e8f8f8f8f8f8f8f8f8f8f8f8f8f/ringback.mp3", // Telnyx sample audio
      //   true // loop enabled
      // );
      
    } catch (error) {
      console.error("Call handling failed:", error);
      throw error;
    }
  },

  async handleCallHangup(callControlId: string) {
    try {
      await prisma.call.update({
        where: { callControlId },
        data: { status: CallStatus.COMPLETED },
      });
    } catch (error) {
      console.error("Hangup processing failed:", error);
    }
  }
};
