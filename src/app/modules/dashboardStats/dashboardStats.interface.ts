export interface DashboardStats {
  // Call counts
  totalCalls: number;
  totalHumanCalls: number;
  totalAICalls: number;
  todayHumanCalls: number;
  todaySuccessCalls: number;
  totalSuccessCalls: number;

  // Call duration statistics
  callDurationStats: {
    minCallDuration: number;
    maxCallDuration: number;
    avgCallDuration: number;
    minAICallDuration: number;
    maxAICallDuration: number;
    avgAICallDuration: number;
    minHumanCallDuration: number;
    maxHumanCallDuration: number;
    avgHumanCallDuration: number;
  };

  // Monthly report
  monthlyReport: MonthlyCallData[];
}

export interface MonthlyCallData {
  month: string;
  successCalls: number;
  totalCalls: number;
  aiCalls: number;
  humanCalls: number;
  humanTotalCallDuration: number; // in seconds
  aiTotalCallDuration: number; // in seconds
}