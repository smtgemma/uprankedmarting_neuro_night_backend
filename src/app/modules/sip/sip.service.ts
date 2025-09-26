// // services/twilioSip.service.ts
// import twilio from "twilio";
// import config from "../../config";

// const accountSid = config.twilio.account_sid;
// const authToken = config.twilio.auth_token;

// if (!accountSid || !authToken) {
//   throw new Error(
//     "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment variables"
//   );
// }

// const client = twilio(accountSid, authToken);

// // Create a SIP endpoint
// const createSipEndpoint = async (data: {
//   userName: string;
//   password: string;
//   sip_domain: string;
// }) => {
//   try {
//     const { userName, password, sip_domain } = data;

//     // First, get the existing SIP domain (don't try to create it)
//     const domainSid = await getSipDomain(sip_domain);
//     // console.log("domainSid", domainSid);
//     if (!domainSid) {
//       throw new Error(
//         `SIP domain ${sip_domain} not found. Please create it first in Twilio console.`
//       );
//     }

//     // Create a credential list
//     const credentialListName = `${sip_domain.replace(
//       ".sip.twilio.com",
//       ""
//     )}-${userName}-creds`;
//     const newCredentialList = await client.sip.credentialLists.create({
//       friendlyName: credentialListName,
//     });

//     // console.log("newCredentialList", newCredentialList);
//     // Add credentials to the list
//     await client.sip.credentialLists(newCredentialList.sid).credentials.create({
//       username: userName,
//       password: password,
//     });

//     // Create SIP endpoint credential list mapping
//     const sipEndpoint = await client.sip
//       .domains(domainSid)
//       .auth.calls.credentialListMappings.create({
//         credentialListSid: newCredentialList.sid,
//       });

//     return {
//       // success: true,
//       // message: 'SIP endpoint created successfully',
//       // data: {
//       credentialListSid: newCredentialList.sid,
//       userName,
//       sip_domain,
//       sipUri: `${userName}@${sip_domain}`,
//       fullSipUri: `sip:${userName}@${sip_domain}`,
//       domainSid: domainSid,
//       // }
//     };
//   } catch (error: any) {
//     // Handle Twilio API errors specifically
//     if (error.code === 20001) {
//       throw new Error(`Invalid Twilio credentials: ${error.message}`);
//     } else if (error.code === 20003) {
//       throw new Error(`Twilio authentication failed: ${error.message}`);
//     } else if (error.code === 20404) {
//       throw new Error(`SIP domain not found: ${error.message}`);
//     }
//     throw new Error(`Failed to create SIP endpoint: ${error.message}`);
//   }
// };

// // Helper function to get existing SIP domain (don't create)
// const getSipDomain = async (domainName: string) => {
//   try {
//     const domains = await client.sip.domains.list();
//     console.log("domains", domains);
//     const existingDomain = domains.find(
//       (domain) => domain.domainName === domainName
//     );

//     return existingDomain ? existingDomain.sid : null;
//   } catch (error: any) {
//     throw new Error(`Failed to get SIP domain: ${error.message}`);
//   }
// };

// // Helper function to get default domain
// const getDefaultDomain = async () => {
//   try {
//     const domains = await client.sip.domains.list();
//     const testDomain = domains.find((domain) =>
//       domain.domainName.includes("test-sip-sajjad")
//     );

//     if (testDomain) {
//       return testDomain.sid;
//     }

//     // If domain doesn't exist, create it
//     const newDomain = await client.sip.domains.create({
//       domainName: "test-sip-sajjad.sip.twilio.com",
//       friendlyName: "uprankcallcenter",
//     });

//     return newDomain.sid;
//   } catch (error: any) {
//     throw new Error(`Failed to get SIP domain: ${error.message}`);
//   }
// };

// // Get all SIP endpoints
// const getSipEndpoints = async (domainSid?: string) => {
//   try {
//     const domain = domainSid || (await getDefaultDomain());
//     const credentialListMappings = await client.sip
//       .domains(domain)
//       .auth.calls.credentialListMappings.list();

//     return credentialListMappings;
//   } catch (error: any) {
//     throw new Error(`Failed to get SIP endpoints: ${error.message}`);
//   }
// };

// export const TwilioSipService = {
//   createSipEndpoint,
//   getSipEndpoints,
//   getDefaultDomain,
// };

// services/twilioSip.service.ts
import twilio from "twilio";
import config from "../../config";

const accountSid = config.twilio.account_sid;
const authToken = config.twilio.auth_token;

if (!accountSid || !authToken) {
  throw new Error(
    "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment variables"
  );
}

const client = twilio(accountSid, authToken);

// Create a SIP endpoint with registration
// const createSipEndpoint = async (data: {
//   userName: string;
//   password: string;
//   sip_domain: string;
// }) => {
//   try {
//     const { userName, password, sip_domain } = data;

//     // Get the existing SIP domain
//     const domainSid = await getSipDomain(sip_domain);
//     if (!domainSid) {
//       throw new Error(
//         `SIP domain ${sip_domain} not found. Please create it first in Twilio console.`
//       );
//     }


//     // Create a unique credential list for this agent
//     const credentialListName = `${sip_domain.replace(".sip.twilio.com", "")}-${userName}-creds`;
//     const newCredentialList = await client.sip.credentialLists.create({
//       friendlyName: credentialListName,
//     });

//     // Add credentials to the list
//     const credential = await client.sip.credentialLists(newCredentialList.sid).credentials.create({
//       username: userName,
//       password: password,
//       sipRegistration: true,
//     });

//     // Map credential list to SIP domain for authentication (this enables registration)
//     const sipEndpoint = await client.sip
//       .domains(domainSid)
//       .auth.calls.credentialListMappings.create({
//         credentialListSid: newCredentialList.sid,
//       });

//     return {
//       credentialListSid: newCredentialList.sid,
//       credentialSid: credential.sid,
//       userName,
//       sip_domain,
//       sipUri: `${userName}@${sip_domain}`,
//       fullSipUri: `sip:${userName}@${sip_domain}`,
//       domainSid: domainSid,
//     };
//   } catch (error: any) {
//     // Handle Twilio API errors
//     if (error.code === 20001) {
//       throw new Error(`Invalid Twilio credentials: ${error.message}`);
//     } else if (error.code === 20003) {
//       throw new Error(`Twilio authentication failed: ${error.message}`);
//     } else if (error.code === 20404) {
//       throw new Error(`SIP domain not found: ${error.message}`);
//     } else if (error.code === 21408) {
//       throw new Error(`Credential list creation failed: ${error.message}`);
//     }
//     throw new Error(`Failed to create SIP endpoint: ${error.message}`);
//   }
// };

const createSipEndpoint = async (data: {
  userName: string;
  password: string;
  sip_domain: string;
}) => {
  try {
    const { userName, password, sip_domain } = data;

    // Get the existing SIP domain
    const domainSid = await getSipDomain(sip_domain);
    if (!domainSid) {
      throw new Error(
        `SIP domain ${sip_domain} not found. Please create it first in Twilio console.`
      );
    }

    // Create a unique credential list for this agent
    const credentialListName = `${sip_domain.replace(".sip.twilio.com", "")}-${userName}-creds`;
    const newCredentialList = await client.sip.credentialLists.create({
      friendlyName: credentialListName,
    });

    // Add credentials (user/password) to the list
    const credential = await client
      .sip
      .credentialLists(newCredentialList.sid)
      .credentials
      .create({
        username: userName,
        password: password,
      });

    // Map credential list to SIP domain for outbound calls
    await client.sip
      .domains(domainSid)
      .auth.calls.credentialListMappings
      .create({
        credentialListSid: newCredentialList.sid,
      });

    // Map credential list to SIP domain for SIP Registration (this is key!)
    await client.sip
      .domains(domainSid)
      .auth.registrations.credentialListMappings
      .create({
        credentialListSid: newCredentialList.sid,
      });

    return {
      credentialListSid: newCredentialList.sid,
      credentialSid: credential.sid,
      userName,
      sip_domain,
      sipUri: `${userName}@${sip_domain}`,
      fullSipUri: `sip:${userName}@${sip_domain}`,
      domainSid: domainSid,
    };
  } catch (error: any) {
    if (error.code === 20001) {
      throw new Error(`Invalid Twilio credentials: ${error.message}`);
    } else if (error.code === 20003) {
      throw new Error(`Twilio authentication failed: ${error.message}`);
    } else if (error.code === 20404) {
      throw new Error(`SIP domain not found: ${error.message}`);
    } else if (error.code === 21408) {
      throw new Error(`Credential list creation failed: ${error.message}`);
    }
    throw new Error(`Failed to create SIP endpoint: ${error.message}`);
  }
};

// Helper function to get existing SIP domain
const getSipDomain = async (domainName: string) => {
  try {
    const domains = await client.sip.domains.list();
    const existingDomain = domains.find(
      (domain) => domain.domainName === domainName
    );
    return existingDomain ? existingDomain.sid : null;
  } catch (error: any) {
    throw new Error(`Failed to get SIP domain: ${error.message}`);
  }
};

// Delete SIP endpoint (cleanup if agent creation fails)
const deleteSipEndpoint = async (credentialListSid: string) => {
  try {
    await client.sip.credentialLists(credentialListSid).remove();
    return true;
  } catch (error: any) {
    console.error("Failed to delete SIP endpoint:", error.message);
    return false;
  }
};

// Update SIP endpoint password
const updateSipEndpointPassword = async (credentialListSid: string, username: string, newPassword: string) => {
  try {
    const credentials = await client.sip
      .credentialLists(credentialListSid)
      .credentials.list();

    const userCredential = credentials.find(cred => cred.username === username);
    if (userCredential) {
      const updatedCredential = await client.sip
        .credentialLists(credentialListSid)
        .credentials(userCredential.sid)
        .update({
          password: newPassword,
        });
      return updatedCredential;
    }
    throw new Error(`Username ${username} not found in credential list`);
  } catch (error: any) {
    throw new Error(`Failed to update SIP endpoint password: ${error.message}`);
  }
};

export const TwilioSipService = {
  createSipEndpoint,
  deleteSipEndpoint,
  updateSipEndpointPassword,
  getSipDomain,
};

