// utils/sendEmail.ts - Updated function
import config from "../config";
import nodemailer from "nodemailer";

export const sendAgentWelcomeEmail = async (
  to: string,
  agentData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    sip_address: string;
    sip_username: string;
    sip_password: string;
  }
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

  const changePasswordLink = `${config.url.frontend}/auth/new-password`;

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

    <h3 style="text-align: center; color: #000; margin-bottom: 24px;">Welcome to Our Agent Team!</h3>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h4 style="color: #000; margin-bottom: 16px;">Your Account Details:</h4>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;"><strong>Name:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;">${agentData.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;"><strong>Email:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;">${agentData.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;">${agentData.phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;"><strong>Temporary Password:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #000;">${agentData.password}</td>
        </tr>
      </table>
      
      <div style="margin-top: 16px; padding: 12px; background-color: #fff3cd; border-radius: 4px;">
        <p style="color: #856404; margin: 0;">
          <strong>Important:</strong> For security reasons, please change your password immediately after first login.
          <br>
         
        </p>
      </div>
    </div>

    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h4 style="color: #2e7d32; margin-bottom: 16px;">SIP Configuration Details:</h4>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;"><strong>SIP Address:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;">${agentData.sip_address}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;"><strong>Username:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;">${agentData.sip_username}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;"><strong>Password:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #000;">${agentData.sip_password}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h4 style="color: #0c5460; margin-bottom: 16px;">Quick Start Guide:</h4>
      <ol style="color: #000; padding-left: 20px; margin: 0;">
        <li>Login to the agent dashboard using your email and temporary password</li>
        <li>Change your password immediately for security</li>
        <li>Configure your SIP phone or softphone with the provided credentials</li>
        <li>Set your status to "Available" when ready to receive calls</li>
      </ol>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${changePasswordLink}" 
         style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Change Your Password Now
      </a>
    </div>

    <div style="text-align: center; margin-top: 24px; color: #666; font-size: 14px;">
      <p>If you did not request this account, please contact our support team immediately.</p>
    </div>
  </div>
  `;

  const text = `
Welcome to Our Agent Team!

Your Account Details:
- Name: ${agentData.name}
- Email: ${agentData.email}
- Phone: ${agentData.phone}
- Temporary Password: ${agentData.password}

IMPORTANT: For security reasons, please change your password immediately after first login.


SIP Configuration Details:
- SIP Address: ${agentData.sip_address}
- Username: ${agentData.sip_username}
- Password: ${agentData.sip_password}

Quick Start Guide:
1. Login to the agent dashboard using your email and temporary password
2. Change your password immediately for security
3. Configure your SIP phone with the provided credentials
4. Set your status to "Available" when ready to receive calls

Change Your Password Now: ${changePasswordLink}

If you did not request this account, please contact support immediately.
  `;

  await transporter.sendMail({
    from: `"Agent Support" <${config.sendEmail.email_from}>`,
    to,
    subject: `Welcome to Our Agent Team - Your Login & SIP Credentials`,
    text: text,
    html: html,
  });
};
