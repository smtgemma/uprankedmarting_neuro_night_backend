import { Router } from "express";
import { HubSpotController } from "./hubspot.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import axios from "axios";
import config from "../../config";
import prisma from "../../utils/prisma";

const router = Router();

router.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const orgId = req.query.state as string;

  if (!code || !orgId) {
    return res.redirect(
      `http://localhost:3000/dashboard/organization/tools?error=Missing+code+or+orgId`
    );
  }

  try {
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.hubspot_client_id,
        client_secret: config.hubspot_client_secret,
        redirect_uri: config.hubspot_redirect_uri,
        code,
      } as any).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await prisma.hubspotCredential.upsert({
      where: { org_id: orgId },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      },
      create: {
        org_id: orgId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      },
    });

    //! success redirect
    return res.redirect(
      `http://localhost:3000/dashboard/organization/tools?success=HubSpot+connected+successfully`
    );
  } catch (err: any) {
    console.error(err.response?.data || err.message);

    //! error redirect
    return res.redirect(
      `http://localhost:3000/dashboard/organization/tools?error=HubSpot+token+exchange+failed`
    );
  }
});

router.get(
  "/connect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  HubSpotController.getHubSpotConnectUrl
);

router.get("/callback", HubSpotController.handleHubSpotCallback);

router.get(
  "/status/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  HubSpotController.getHubSpotStatus
);

router.delete(
  "/disconnect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  HubSpotController.disconnectHubSpot
);

export const HubSpotRoutes = router;