import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { CallService } from "./calls.service";

const handleIncomingCall = catchAsync(async (req: Request, res: Response) => {
  const { call_control_id, from, to } = req.body.data.payload;
  
  // Respond immediately (Telnyx expects <3s response)
  res.status(200).json({ message: "Processing call" });
  
  // Process call async after response
  await CallService.handleIncomingCall(
    call_control_id, 
    from.phone_number, 
    to.phone_number
  );
});

const handleCallHangup = catchAsync(async (req: Request, res: Response) => {
  const { call_control_id } = req.body.data.payload;
  await CallService.handleCallHangup(call_control_id);
  res.status(200).end();
});

export const CallController = {
  handleIncomingCall,
  handleCallHangup
};
