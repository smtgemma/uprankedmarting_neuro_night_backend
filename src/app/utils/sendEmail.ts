import config from "../config";
import nodemailer from "nodemailer";

export const sendEmail = async (
  to: string,
  otp?: number,
  isVerification: boolean = false
) => {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: config.sendEmail.brevo_email,
      pass: config.sendEmail.brevo_pass,
    },
  });

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const html = `
  <div style="max-width: 600px; margin: 0 auto; background-color: #F6F7F9; color: #000; border-radius: 8px; padding: 24px;">
    <table style="width: 100%;">
      <tr>
        <td>
          <div style="padding: 5px; text-align: center;">
            <img src="https://res.cloudinary.com/shariful10/image/upload/v1751971147/logo_cfqynn.png" alt="logo" style="height: 40px; margin-bottom: 16px;" />
          </div>
        </td>
        <td style="text-align: right; color: #999;">${formattedDate}</td>
      </tr>
    </table>

    ${
      isVerification
        ? `<h3 style="text-align: center; color: #000;">Verify Your Email</h3>
           <div style="padding: 0 1em;">
             <p style="text-align: left; line-height: 28px; color: #000;">
               <strong style="color: #000;">Your OTP:</strong> ${otp} <br />
               Please use this OTP to verify your email. It is valid for 5 minutes.
             </p>
           </div>`
        : `<h3 style="text-align: center; color: #000;">Reset Your Password</h3>
           <div style="padding: 0 1em;">
             <p style="text-align: left; line-height: 28px; color: #000;">
               <strong style="color: #000;">Your OTP:</strong> ${otp} <br />
               Please use this OTP to reset your password. It is valid for 5 minutes.
             </p>
           </div>`
    }
  </div>
  `;

  await transporter.sendMail({
    from: `"Super Job" <${config.sendEmail.email_from}>`,
    to,
    subject: `${
      isVerification
        ? `Verify Your Email within 5 Minutes`
        : `Reset Your Password within 5 Minutes`
    }`,
    text: `Your OTP is ${otp}. Please use it to ${
      isVerification ? "verify your email" : "reset your password"
    }. It is valid for 5 minutes.`,
    html: html,
  });
};