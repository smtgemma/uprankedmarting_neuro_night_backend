export interface CallData {
  callerNumber: string;
  calledNumber: string;
  callTime: Date;
}
export interface TelnyxEvent {
  event_type: string;
  call_control_id: string;
  from: string;
  to: string;
}
