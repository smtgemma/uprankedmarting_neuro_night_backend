// import config from "../config";
// import nodemailer from "nodemailer";

// export const sendEmail = async (
//   to: string,
//   otp?: number,
//   isVerification: boolean = false
// ) => {
//   const transporter = nodemailer.createTransport({
//     host: "smtp-relay.brevo.com",
//     port: 587,
//     secure: false,
//     auth: {
//       user: config.sendEmail.brevo_email,
//       pass: config.sendEmail.brevo_pass,
//     },
//   });

//   const formattedDate = new Intl.DateTimeFormat("en-US", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   }).format(new Date());

//   const html = `
//   <div style="max-width: 600px; margin: 0 auto; background-color: #F6F7F9; color: #000; border-radius: 8px; padding: 24px;">
//     <table style="width: 100%;">
//       <tr>
//         <td>
//           <div style="padding: 5px; text-align: center;">
//             <img src="https://res.cloudinary.com/shariful10/image/upload/v1751971147/logo_cfqynn.png" alt="logo" style="height: 40px; margin-bottom: 16px;" />
//           </div>
//         </td>
//         <td style="text-align: right; color: #999;">${formattedDate}</td>
//       </tr>
//     </table>

//     ${
//       isVerification
//         ? `<h3 style="text-align: center; color: #000;">Verify Your Email</h3>
//            <div style="padding: 0 1em;">
//              <p style="text-align: left; line-height: 28px; color: #000;">
//                <strong style="color: #000;">Your OTP:</strong> ${otp} <br />
//                Please use this OTP to verify your email. It is valid for 5 minutes.
//              </p>
//            </div>`
//         : `<h3 style="text-align: center; color: #000;">Reset Your Password</h3>
//            <div style="padding: 0 1em;">
//              <p style="text-align: left; line-height: 28px; color: #000;">
//                <strong style="color: #000;">Your OTP:</strong> ${otp} <br />
//                Please use this OTP to reset your password. It is valid for 5 minutes.
//              </p>
//            </div>`
//     }
//   </div>
//   `;

//   await transporter.sendMail({
//     from: `"Uprank Marting" <${config.sendEmail.email_from}>`,
//     to,
//     subject: `${
//       isVerification
//         ? `Verify Your Email within 5 Minutes`
//         : `Reset Your Password within 5 Minutes`
//     }`,
//     text: `Your OTP is ${otp}. Please use it to ${
//       isVerification ? "verify your email" : "reset your password"
//     }. It is valid for 5 minutes.`,
//     html: html,
//   });
// };



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

  const loginUrl = `${process.env.FRONTEND_URL}/auth/login`;

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
        ${isVerification ? "Verify Your Email" : "Reset Your Password"}
      </h2>

      <p style="font-size:16px;line-height:26px;color:#444;text-align:center;margin-bottom:30px;">
        ${
          isVerification
            ? "Thank you for joining <strong>Answer Smart</strong>! Please use the OTP below to verify your email."
            : "We received a request to reset your password for <strong>Answer Smart</strong>. Use the OTP below to proceed."
        }
      </p>

      <!-- OTP Box -->
      <div style="text-align:center;margin-bottom:30px;">
        <div style="display:inline-block;padding:15px 30px;border-radius:8px;background:#f4f7ff;color:#2b7fff;font-size:22px;font-weight:bold;letter-spacing:3px;">
          ${otp}
        </div>
      </div>

      <p style="font-size:14px;line-height:22px;color:#555;text-align:center;margin-bottom:30px;">
        This OTP is valid for <strong>5 minutes</strong>.  
        ${
          isVerification
            ? "Once verified, you’ll be redirected to your account."
            : "After resetting your password, you can log in securely."
        }
      </p>

      <!-- Button -->
      <div style="text-align:center;margin-bottom:40px;">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#2b7fff;color:#fff;text-decoration:none;font-size:16px;border-radius:6px;font-weight:bold;">
          Go to Login
        </a>
      </div>

      <p style="font-size:12px;color:#999;text-align:center;">
        If you didn’t request this, you can safely ignore this email.
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
    subject: `${
      isVerification
        ? `Verify Your Email - Answer Smart`
        : `Reset Your Password - Answer Smart`
    }`,
    text: `Your OTP is ${otp}. Please use it to ${
      isVerification ? "verify your email" : "reset your password"
    }. It is valid for 5 minutes.`,
    html,
  });
};
