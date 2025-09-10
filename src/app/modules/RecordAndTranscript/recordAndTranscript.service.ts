// services/twilio.service.ts
import { Request } from "express";
import twilio from "twilio";
import prisma from "../../utils/prisma";
import config from "../../config";
import axios from "axios";

const accountSid = config.twilio.account_sid;
const authToken = config.twilio.auth_token;

if (!accountSid || !authToken) {
  throw new Error(
    "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment variables"
  );
}

const client = twilio(accountSid, authToken);

// Get recordings metadata (with proxy play/download URLs)
 const getCallRecording = async (callSid: string) => {

  const recordings = await client.recordings.list({ callSid });

  if (recordings.length === 0) {
    throw new Error(`No recordings found for call SID: ${callSid}`);
  }

  const data = recordings.map((r) => ({
    accountSid: r.accountSid,
    apiVersion: r.apiVersion,
    callSid: r.callSid,
    conferenceSid: r.conferenceSid,
    dateCreated: r.dateCreated,
    dateUpdated: r.dateUpdated,
    startTime: r.startTime,
    duration: r.duration,
    sid: r.sid,
    price: r.price,
    priceUnit: r.priceUnit,
    status: r.status,
    channels: r.channels,
    source: r.source,
    errorCode: r.errorCode,
    uri: r.uri,
    subresourceUris: r.subresourceUris,
    // Instead of exposing Twilio URL, we proxy via backend
    mediaUrl: `/recordings/${r.sid}/play`, // stream play
    downloadUrl: `/recordings/${r.sid}/download`, // download file
    transcriptionUrl: `/recordings/${r.sid}/transcriptions`,
  }));

  return data;
};



// Play recording in dashboard (streaming)
export const playRecording = async (req: Request, res: any) => {
  const { recordingSid } = req.params;
  console.log(recordingSid)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      auth: { username: accountSid, password: authToken },
    });

    console.log("got response", response?.data)
    res.setHeader("Content-Type", "audio/mpeg");
    response.data.pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to stream recording", error: error.message });
  }
};

// Play recording by callSid (gets first recording for that call)
export const playRecordingByCallSid = async (req:any, res:any) => {
  const { callSid } = req.params;

  console.log("callSid", callSid)
  try {
    // First, get recordings for this call
    const recordings = await client.recordings.list({ callSid });

    if (recordings.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `No recordings found for call SID: ${callSid}` 
      });
    }

    // Use the first recording
    const recordingSid = recordings[0].sid;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;

    const response = await axios.get(url, {
      responseType: "stream",
      auth: { username: accountSid, password: authToken },
      headers: {
        'Accept': 'audio/mpeg',
      },
    });

    // Set proper headers for audio streaming
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `inline; filename="${recordingSid}.mp3"`);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Accept-Ranges", "bytes");

    // Pipe the audio stream to the response
    response.data.pipe(res);

    response.data.on('error', (error: any) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: "Failed to stream recording", 
          error: error.message 
        });
      }
    });

  } catch (error: any) {
    console.error('Play recording error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to stream recording", 
      error: error.message 
    });
  }
};

// Download recording
export const downloadRecording = async (req: Request, res: any) => {
  const { recordingSid } = req.params;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      auth: { username: accountSid, password: authToken },
    });

    res.setHeader("Content-Disposition", `attachment; filename=${recordingSid}.mp3`);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(response.data);
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to download recording", error: error.message });
  }
};

// Get call transcript by call SID
const getCallTranscript = async (callSid: string) => {
  try {
    const transcripts = await client.transcriptions.list({
      // callSid,
      limit: 1,
    });

    if (transcripts.length === 0) {
      return null;
    }

    const transcript = transcripts[0];
    return {
      sid: transcript.sid,
      // callSid: transcript.callSid,
      dateCreated: transcript.dateCreated,
      dateUpdated: transcript.dateUpdated,
      status: transcript.status,
      transcriptionText: transcript.transcriptionText,
      price: transcript.price,
      priceUnit: transcript.priceUnit,
      uri: transcript.uri,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch call transcript: ${error.message}`);
  }
};

// Get both recording and transcript for a call
const getCallRecordingAndTranscript = async (callSid: string) => {
  try {
    const [recording, transcript] = await Promise.all([
      getCallRecording(callSid),
      getCallTranscript(callSid),
    ]);

    return {
      recording,
      transcript,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch call data: ${error.message}`);
  }
};

// Get recording by recording SID
const getRecordingBySid = async (recordingSid: string) => {
  try {
    const recording = await client.recordings(recordingSid).fetch();
    return {
      sid: recording.sid,
      callSid: recording.callSid,
      duration: recording.duration,
      dateCreated: recording.dateCreated,
      price: recording.price,
      priceUnit: recording.priceUnit,
      status: recording.status,
      source: recording.source,
      uri: recording.uri,
      downloadUrl: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recording.sid}.mp3`,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch recording: ${error.message}`);
  }
};

// Get transcript by transcript SID
const getTranscriptBySid = async (transcriptSid: string) => {
  try {
    const transcript = await client.transcriptions(transcriptSid).fetch();
    return {
      sid: transcript.sid,
      // callSid: transcript.callSid,
      dateCreated: transcript.dateCreated,
      dateUpdated: transcript.dateUpdated,
      status: transcript.status,
      transcriptionText: transcript.transcriptionText,
      price: transcript.price,
      priceUnit: transcript.priceUnit,
      uri: transcript.uri,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch transcript: ${error.message}`);
  }
};

// Get call recordings and transcripts for an organization
const getOrganizationCallRecords = async (organizationId: string) => {
  try {
    // Get all calls for the organization
    const calls = await prisma.call.findMany({
      where: { organizationId: organizationId },
      select: {  call_sid: true },
    });

    const callRecords = await Promise.all(
      calls.map(async (call) => {
        const callSid =  call.call_sid;
        if (!callSid) return null;

        try {
          const [recording, transcript] = await Promise.all([
            getCallRecording(callSid),
            getCallTranscript(callSid),
          ]);

          return {
            callSid,
            recording,
            transcript,
          };
        } catch (error: any) {
          console.error(`Failed to fetch data for call ${callSid}:`, error);
          return {
            callSid,
            recording: null,
            transcript: null,
            error: error.message,
          };
        }
      })
    );

    return callRecords.filter((record) => record !== null);
  } catch (error: any) {
    throw new Error(
      `Failed to fetch organization call records: ${error.message}`
    );
  }
};


export const RecordAndTranscriptService = {
  getCallRecording,
  getCallTranscript,
  getCallRecordingAndTranscript,
  getRecordingBySid,
  getTranscriptBySid,
  getOrganizationCallRecords,
};
