// routes/twilioSip.routes.ts
import express from 'express';
import { TwilioSipController } from './sip.controller';

const router = express.Router();

// Create SIP endpoint
router.post('/', TwilioSipController.createSipEndpoint);

// Get SIP endpoints
router.get('/', TwilioSipController.getSipEndpoints);

// Get default SIP domain
router.get('/sip-domain', TwilioSipController.getDefaultSipDomain);

export const SipRoutes = router;