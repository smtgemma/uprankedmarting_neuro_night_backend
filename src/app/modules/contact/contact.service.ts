import status from "http-status";
import AppError from "../../errors/AppError";
import { sendContactEmail } from "../../utils/sendContactEmail";
import config from "../../config";

const sendContactFormEmail = async (data: {
  name: string;
  email: string;
  message: string;
}) => {
  try {
    const { name, email, message } = data;

    // Send email to super admin
    await sendContactEmail(config.superAdmin.email as string, {
      name,
      email,
      message,
    });

    return {
      message: "Contact form submitted successfully",
    };
  } catch (error: any) {
    console.error("Error sending contact form email:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to send contact form email: ${error.message}`
    );
  }
};

export const ContactService = {
  sendContactFormEmail,
};
