import config from "../config";
import nodemailer from "nodemailer";

// Initialize transporter (reuse same config as sendEmail)
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: config.sendEmail.brevo_email,
    pass: config.sendEmail.brevo_pass,
  },
});

interface PhoneNumberRequestPayload {
  requesterName: string;
  requestedPhonePattern?: string;
  message?: string;
}

/**
 * Send phone number request notification to Super Admin
 */
export const sendPhoneNumberRequestEmail = async (
  payload: PhoneNumberRequestPayload,
  organizationEmail: string
) => {
  const { requesterName, requestedPhonePattern, message } = payload;

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const adminDashboardUrl = `${config.url.frontend}/dashboard/admin/numbers`;

  const html = `
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
    
    <!-- Header -->
    <div style="background:#2b7fff;padding:20px;text-align:center;">
      <img src="https://res.cloudinary.com/djzt5tkwu/image/upload/v1758844524/q46e8t4ujkmajsp1glkg.svg" alt="Answer Smart" style="height:40px;" />
    </div>

    <!-- Body -->
    <div style="padding:30px 25px;color:#333;">
      <p style="font-size:14px;color:#888;margin:0 0 10px 0;text-align:right;">${formattedDate}</p>
      
      <h2 style="text-align:center;color:#2b7fff;margin-bottom:20px;">
        New Phone Number Request
      </h2>

      <p style="font-size:16px;line-height:26px;color:#444;margin-bottom:20px;">
        A new phone number request has been submitted by an organization owner.
      </p>

      <!-- Request Details -->
      <div style="background:#f8f9fc;padding:20px;border-radius:8px;margin:20px 0;font-size:15px;">
        <p style="margin:8px 0;"><strong>Requester:</strong> ${requesterName}</p>
        <p style="margin:8px 0;"><strong>Email:</strong> ${organizationEmail}</p>
        <p style="margin:8px 0;"><strong>Pattern:</strong> ${requestedPhonePattern || "<em>Not specified</em>"}</p>
        ${message ? `<p style="margin:8px 0;"><strong>Message:</strong><br/><em>${message}</em></p>` : ""}
      </div>

      <p style="font-size:14px;line-height:22px;color:#555;text-align:center;margin:30px 0;">
        Please review and take action in the admin dashboard.
      </p>

      <!-- Button -->
      <div style="text-align:center;margin-bottom:40px;">
        <a href="${adminDashboardUrl}" style="display:inline-block;padding:12px 24px;background:#2b7fff;color:#fff;text-decoration:none;font-size:16px;border-radius:6px;font-weight:bold;">
          Review Request
        </a>
      </div>

      <p style="font-size:12px;color:#999;text-align:center;">
        This is an automated notification from Answer Smart.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f6f7f9;padding:15px;text-align:center;font-size:12px;color:#777;">
      © ${new Date().getFullYear()} Answer Smart. All rights reserved.
    </div>
  </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Answer Smart" <${config.sendEmail.email_from}>`,
      to: config.superAdmin.email, // From .env
      subject: `New Phone Number Request - ${requesterName}`,
      text: `
New phone number request:

Requester: ${requesterName}
Email: ${organizationEmail}
Pattern: ${requestedPhonePattern || "Not specified"}
Message: ${message || "None"}

Review here: ${adminDashboardUrl}
      `.trim(),
      html,
    });

    console.log("Phone number request email sent to super admin");
  } catch (error: any) {
    console.error("Failed to send phone number request email:", error.message);
    // Do NOT throw — should not block user flow
  }
};