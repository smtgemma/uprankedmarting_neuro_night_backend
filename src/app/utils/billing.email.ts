import config from "../config";
import nodemailer from "nodemailer";

interface BillingEmailData {
  to: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate?: string;
  billingPeriod?: string;
  invoiceUrl?: string;
  status: "paid" | "due" | "failed" | "refunded";
  type: "invoice" | "receipt" | "payment_failed" | "refund";
}

export const sendBillingEmail = async (data: BillingEmailData) => {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: config.sendEmail.brevo_email,
      pass: config.sendEmail.brevo_pass,
    },
  });

  const { subject, html, text } = generateBillingEmailContent(data);

  await transporter.sendMail({
    from: `"Answer Smart Billing" <${config.sendEmail.email_from}>`,
    to: data.to,
    subject,
    text,
    html,
  });
};

const generateBillingEmailContent = (data: BillingEmailData) => {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: data.currency.toUpperCase(),
  }).format(data.amount);

  let subject = "";
  let title = "";
  let message = "";
  let buttonText = "";
  let buttonUrl = data.invoiceUrl || `${process.env.FRONTEND_URL}/billing`;
  let showDueDate = false;
  let statusColor = "";

  switch (data.type) {
    case "invoice":
      subject = `Invoice #${data.invoiceNumber} from Answer Smart`;
      title = "Your Invoice is Ready";
      message = `Thank you for your business. Your invoice #${data.invoiceNumber} for ${formattedAmount} is now available.`;
      buttonText = "View Invoice";
      showDueDate = true;
      statusColor = "#2b7fff";
      break;

    case "receipt":
      subject = `Payment Receipt #${data.invoiceNumber} - Answer Smart`;
      title = "Payment Confirmed";
      message = `Thank you for your payment of ${formattedAmount}. Your transaction has been completed successfully.`;
      buttonText = "View Receipt";
      statusColor = "#10b981";
      break;

    case "payment_failed":
      subject = `Payment Failed - Invoice #${data.invoiceNumber}`;
      title = "Payment Failed";
      message = `We were unable to process your payment of ${formattedAmount} for invoice #${data.invoiceNumber}. Please update your payment method to avoid service interruption.`;
      buttonText = "Update Payment Method";
      buttonUrl = `${process.env.FRONTEND_URL}/billing/payment-methods`;
      statusColor = "#ef4444";
      break;

    case "refund":
      subject = `Refund Processed - Invoice #${data.invoiceNumber}`;
      title = "Refund Issued";
      message = `A refund of ${formattedAmount} has been processed for invoice #${data.invoiceNumber}. The amount should appear in your account within 5-7 business days.`;
      buttonText = "View Details";
      statusColor = "#8b5cf6";
      break;
  }

  const html = `
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
    
    <!-- Header -->
    <div style="background:${statusColor};padding:20px;text-align:center;">
      <img src="https://res.cloudinary.com/djzt5tkwu/image/upload/v1758844524/q46e8t4ujkmajsp1glkg.svg" alt="Answer Smart" style="height:40px;" />
    </div>

    <!-- Body -->
    <div style="padding:30px 25px;color:#333;">
      <p style="font-size:14px;color:#888;margin:0 0 10px 0;text-align:right;">${formattedDate}</p>
      
      <h2 style="text-align:center;color:${statusColor};margin-bottom:20px;">
        ${title}
      </h2>

      <p style="font-size:16px;line-height:26px;color:#444;text-align:center;margin-bottom:30px;">
        Hello ${data.customerName},
      </p>

      <p style="font-size:16px;line-height:26px;color:#444;text-align:center;margin-bottom:30px;">
        ${message}
      </p>


      
      <!-- Invoice Details -->
      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:30px;border-left:4px solid ${statusColor};">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Invoice Number:</td>
            <td style="padding:8px 0;color:#334155;font-size:14px;text-align:right;font-weight:bold;">#${
              data.invoiceNumber
            }</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Amount:</td>
            <td style="padding:8px 0;color:#334155;font-size:14px;text-align:right;font-weight:bold;">${formattedAmount}</td>
          </tr>
          ${
            data.billingPeriod
              ? `
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Billing Period:</td>
            <td style="padding:8px 0;color:#334155;font-size:14px;text-align:right;">${data.billingPeriod}</td>
          </tr>
          `
              : ""
          }
          ${
            showDueDate && data.dueDate
              ? `
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Due Date:</td>
            <td style="padding:8px 0;color:#334155;font-size:14px;text-align:right;">${data.dueDate}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Status:</td>
            <td style="padding:8px 0;color:${statusColor};font-size:14px;text-align:right;font-weight:bold;text-transform:capitalize;">
              ${data.status}
            </td>
          </tr>
        </table>
      </div>

      <!-- Button -->
      <div style="text-align:center;margin-bottom:30px;">
        <a href="${buttonUrl}" style="display:inline-block;padding:12px 24px;background:${statusColor};color:#fff;text-decoration:none;font-size:16px;border-radius:6px;font-weight:bold;">
          ${buttonText}
        </a>
      </div>

      <!-- Additional Info -->
      <div style="background:#fefce8;border:1px solid#fef08a;border-radius:6px;padding:15px;margin-bottom:20px;">
        <p style="font-size:14px;color:#854d0e;margin:0;text-align:center;">
          💡 Need help? Visit our <a href="${
            process.env.FRONTEND_URL
          }/help/billing" style="color:#854d0e;text-decoration:underline;">Billing Help Center</a>
        </p>
      </div>

      <p style="font-size:12px;color:#999;text-align:center;margin-bottom:0;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f6f7f9;padding:15px;text-align:center;font-size:12px;color:#777;">
      <p style="margin:0 0 8px 0;">
        © ${new Date().getFullYear()} Answer Smart. All rights reserved.
      </p>
      <p style="margin:0;font-size:11px;">
        <a href="${
          process.env.FRONTEND_URL
        }/privacy" style="color:#777;text-decoration:none;margin:0 10px;">Privacy Policy</a>
        <a href="${
          process.env.FRONTEND_URL
        }/terms" style="color:#777;text-decoration:none;margin:0 10px;">Terms of Service</a>
        <a href="${
          process.env.FRONTEND_URL
        }/contact" style="color:#777;text-decoration:none;margin:0 10px;">Contact Support</a>
      </p>
    </div>
  </div>
  `;

  const text = `
${title}

Hello ${data.customerName},

${message}

Invoice Details:
- Invoice Number: #${data.invoiceNumber}
- Amount: ${formattedAmount}
${data.billingPeriod ? `- Billing Period: ${data.billingPeriod}` : ""}
${showDueDate && data.dueDate ? `- Due Date: ${data.dueDate}` : ""}
- Status: ${data.status}

${buttonText}: ${buttonUrl}

Need help? Visit our Billing Help Center: ${
    process.env.FRONTEND_URL
  }/help/billing

This is an automated message. Please do not reply to this email.

© ${new Date().getFullYear()} Answer Smart. All rights reserved.
  `;

  return { subject, html, text };
};
