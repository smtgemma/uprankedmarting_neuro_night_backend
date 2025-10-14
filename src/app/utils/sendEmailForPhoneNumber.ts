// ============ 5. EMAIL SERVICE ============
// Add to your emailSender.ts

import nodemailer from "nodemailer";
import config from "../config";

interface PhoneNumberRequestData {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  message?: string;
  requestedPhonePattern?: string
}

export const sendPhoneNumberRequestEmail = async (data: PhoneNumberRequestData, from: string) => {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: config.sendEmail.brevo_email,
      pass: config.sendEmail.brevo_pass,
    },
  });

  // console.log("data", from, config.sendEmail);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const { requesterName, requesterEmail, requesterPhone, message, requestedPhonePattern } = data;

  const html = `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      <div style="background:#2b7fff;padding:20px;text-align:center;">
        <img src="https://res.cloudinary.com/djzt5tkwu/image/upload/v1758844524/q46e8t4ujkmajsp1glkg.svg" alt="Answer Smart" style="height:40px;" />
      </div>

      <div style="padding:30px 25px;color:#333;">
        <p style="font-size:14px;color:#888;margin:0 0 10px 0;text-align:right;">${formattedDate}</p>
        
        <h2 style="text-align:center;color:#2b7fff;margin-bottom:20px;">
          New Phone Number Request
        </h2>

        <div style="margin-bottom:30px;">
          <p style="font-size:16px;color:#555;"><strong>Name:</strong> ${requesterName}</p>
          <p style="font-size:16px;color:#555;"><strong>Email:</strong> ${requesterEmail}</p>
          <p style="font-size:16px;color:#555;"><strong>Phone:</strong> ${requesterPhone}</p>
          ${requestedPhonePattern ? `<p style="font-size:16px;color:#555;"><strong>Pattern:</strong> ${requestedPhonePattern}</p>` : ""}
          ${message ? `<p style="font-size:16px;color:#555;"><strong>Message:</strong></p>
          <p style="font-size:16px;color:#555;background:#f4f7ff;padding:15px;border-radius:8px;">${message}</p>` : ""}
        </div>
      </div>

      <div style="background:#f6f7f9;padding:15px;text-align:center;font-size:12px;color:#777;">
        © ${new Date().getFullYear()} Answer Smart. All rights reserved.
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from,
    to: "mdsajjadhosenshohan.dev@gmail.com",
    subject: `New Phone Number Request - Answer Smart`,
    html,
  });

  console.log(" Email sent successfully:", info.messageId);
  return info;
};