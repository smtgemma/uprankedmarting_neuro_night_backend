import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: 5500, // process.env.PORT,
  host: process.env.HOST,
  databaseUrl: process.env.DATABASE_URL,
  hubspot_api_key: process.env.HUBSPOT_API_KEY,
  telnyx: {
    telnyxApiKey: process.env.TELNYX_API_KEY,
    telnyxWebhookSecret: process.env.TELNYX_WEBHOOK_SECRET, // Add this
    telnyxCallControlId: process.env.TELNYX_CALL_CONTROL_ID,
    telnyxPhoneNumber: process.env.TELNYX_PHONE_NUMBER,
    sales_did: process.env.SALES_DID,
    support_did: process.env.SUPPORT_DID,
  },
  sendEmail: {
    email_from: process.env.EMAIL_FROM,
    brevo_pass: process.env.BREVO_PASS,
    brevo_email: process.env.BREVO_EMAIL,
  },
  jwt: {
    access: {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    },
    refresh: {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    },
    resetPassword: {
      expiresIn: process.env.JWT_RESET_PASS_ACCESS_EXPIRES_IN,
    },
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    phone: process.env.SUPER_ADMIN_PHONE,
  },
  url: {
    image: process.env.IMAGE_URL,
    backend: process.env.BACKEND_URL,
    frontend: process.env.FRONTEND_URL,
  },
  verify: {
    email: process.env.VERIFY_EMAIL_LINK,
    resetPassUI: process.env.RESET_PASS_UI_LINK,
    resetPassLink: process.env.VERIFY_RESET_PASS_LINK,
  },
  cloudinary: {
    cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
    cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  twilio: {
    account_sid: process.env.ACCOUNT_SID,
    auth_token: process.env.AUTH_TOKEN,
    // credential_list_sid: process.env.CREDENTIAL_LIST_SID,
    twilio_number: process.env.TWILIO_NUMBER,
    twilio_auto_route_url: process.env.TWILIO_AUTO_ROUTE_URL,
  },
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  // Google Sheets Configuration
  google_sheets_spreadsheet_id: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  google_client_id: process.env.GOOGLE_CLIENT_ID,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
  google_redirect_uri: process.env.GOOGLE_REDIRECT_URI,

  // HubSpot Configuration - Fixed
  hubspot_client_id: process.env.HUBSPOT_CLIENT_ID,
  hubspot_client_secret: process.env.HUBSPOT_CLIENT_SECRET,
  hubspot_redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
};
