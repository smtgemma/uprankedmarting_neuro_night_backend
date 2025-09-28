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

const createSipEndpoint = async (data: {
  userName: string;
  password: string;
  sip_domain: string;
}) => {
  const { userName, password, sip_domain } = data;
  try {

    // Get the existing SIP domain
    const domainSid = await getSipDomain(sip_domain);
    if (!domainSid) {
      throw new Error(
        `SIP domain ${sip_domain} not found. Please create it first in Twilio console.`
      );
    }

    // Get or create the main credential list for the domain
    const credentialListSid = await getOrCreateCredentialList(domainSid, sip_domain);
    
    // Check if username already exists in the credential list
    const existingCredential = await checkExistingCredential(credentialListSid, userName);
    if (existingCredential) {
      throw new Error(`Username ${userName} already exists in the credential list`);
    }

    // Add credentials (user/password) to the existing list
    const credential = await client
      .sip
      .credentialLists(credentialListSid)
      .credentials
      .create({
        username: userName,
        password: password,
      });

    return {
      credentialListSid: credentialListSid,
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
      throw new Error(`Credential creation failed: ${error.message}`);
    } else if (error.code === 21405) {
      throw new Error(`Username ${userName} already exists in credential list`);
    }
    throw new Error(`Failed to create SIP endpoint: ${error.message}`);
  }
};

// Helper function to get or create the main credential list for a domain
const getOrCreateCredentialList = async (domainSid: string, domainName: string) => {
  try {
    const baseDomainName = domainName.replace(".sip.twilio.com", "");
    const mainCredentialListName = `${baseDomainName}-main-credentials`;
    
    // List all credential lists
    const credentialLists = await client.sip.credentialLists.list();
    
    // Look for existing credential list for this domain
    const existingCredentialList = credentialLists.find(
      list => list.friendlyName === mainCredentialListName
    );

    if (existingCredentialList) {
      console.log(`Using existing credential list: ${existingCredentialList.sid}`);
      return existingCredentialList.sid;
    }

    // Create new main credential list for the domain
    console.log(`Creating new credential list: ${mainCredentialListName}`);
    const newCredentialList = await client.sip.credentialLists.create({
      friendlyName: mainCredentialListName,
    });

    // Map credential list to SIP domain (only for new lists)
    await mapCredentialListToDomain(domainSid, newCredentialList.sid);

    return newCredentialList.sid;
  } catch (error: any) {
    throw new Error(`Failed to get or create credential list: ${error.message}`);
  }
};

// Map credential list to SIP domain (with proper error handling)
const mapCredentialListToDomain = async (domainSid: string, credentialListSid: string) => {
  try {
    // Map for calls
    await client.sip
      .domains(domainSid)
      .auth.calls.credentialListMappings
      .create({
        credentialListSid: credentialListSid,
      });
    console.log(`Mapped credential list to domain for calls`);
  } catch (error: any) {
    if (error.code === 21408) {
      console.log(`Credential list already mapped for calls: ${error.message}`);
    } else {
      throw new Error(`Failed to map credential list for calls: ${error.message}`);
    }
  }

  try {
    // Map for registrations
    await client.sip
      .domains(domainSid)
      .auth.registrations.credentialListMappings
      .create({
        credentialListSid: credentialListSid,
      });
    console.log(`Mapped credential list to domain for registrations`);
  } catch (error: any) {
    if (error.code === 21408) {
      console.log(`Credential list already mapped for registrations: ${error.message}`);
    } else {
      throw new Error(`Failed to map credential list for registrations: ${error.message}`);
    }
  }
};

// Check if credential already exists
const checkExistingCredential = async (credentialListSid: string, username: string) => {
  try {
    const credentials = await client.sip
      .credentialLists(credentialListSid)
      .credentials
      .list();

    return credentials.find(cred => cred.username === username);
  } catch (error: any) {
    throw new Error(`Failed to check existing credentials: ${error.message}`);
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

// Delete SIP endpoint (now just removes credential from the list)
const deleteSipEndpoint = async (credentialListSid: string, username: string) => {
  try {
    const credentials = await client.sip
      .credentialLists(credentialListSid)
      .credentials
      .list();

    const userCredential = credentials.find(cred => cred.username === username);
    if (userCredential) {
      await client.sip
        .credentialLists(credentialListSid)
        .credentials(userCredential.sid)
        .remove();
      return true;
    }
    
    console.warn(`Username ${username} not found in credential list ${credentialListSid}`);
    return false;
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
      .credentials
      .list();

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