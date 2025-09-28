import { Router } from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ContactValidation } from "./contact.validation";
import { ContactController } from "./contact.controller";

const router = Router();

router.post(
  "/send",
  validateRequest(ContactValidation.ContactFormSchema),
  ContactController.sendContactForm
);

export const ContactRoutes = router;
