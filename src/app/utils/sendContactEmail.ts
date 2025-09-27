import nodemailer from "nodemailer";
import config from "../config";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export const sendContactEmail = async (to: string, data: ContactFormData) => {
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

  const { name, email, message } = data;

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
          New Contact Form Submission
        </h2>

        <p style="font-size:16px;line-height:26px;color:#444;text-align:center;margin-bottom:30px;">
          You have received a new message from <strong>${name}</strong> via the Answer Smart contact form.
        </p>

        <!-- Contact Details -->
        <div style="margin-bottom:30px;">
          <p style="font-size:16px;color:#555;"><strong>Name:</strong> ${name}</p>
          <p style="font-size:16px;color:#555;"><strong>Email:</strong> ${email}</p>
          <p style="font-size:16px;color:#555;"><strong>Message:</strong></p>
          <p style="font-size:16px;color:#555;background:#f4f7ff;padding:15px;border-radius:8px;">${message}</p>
        </div>

        <p style="font-size:14px;color:#999;text-align:center;">
          Please respond to this inquiry at your earliest convenience.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f6f7f9;padding:15px;text-align:center;font-size:12px;color:#777;">
        © ${new Date().getFullYear()} Answer Smart. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Answer Smart" <${config.sendEmail.email_from}>`,
    to,
    replyTo: email, // Allow admin to reply directly to the sender
    subject: `New Contact Form Submission - Answer Smart`,
    text: `New contact form submission:\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
    html,
  });
};
