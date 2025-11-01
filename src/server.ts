import { Server } from "http";
import { seedSuperAdmin } from "./seedSuperAdmin";
import app from "./app";
import config from "./app/config";
import cron from "node-cron";
import prisma from "./app/utils/prisma";
import { ToolsService } from "./app/modules/tools/tools.service";

// Simple rate limiter to avoid Google Sheets API quota issues
const rateLimit = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

let server: Server;

const main = async () => {
  try {
    // Seed Super Admin
    await seedSuperAdmin();

    // Start the server
    server = app.listen(config.port, () => {
      console.log(
        `🚀 App is listening on: http://${config.host}:${config.port}`
      );
    });

    // Schedule the Q&A pairs sync every 10 minutes
    cron.schedule(
      "*/10 * * * *",
      async () => {
        console.log("⏰ Running scheduled Q&A pairs sync to Google Sheets...");

        try {
          // Fetch organizations with Google Sheets configured
          const organizations = await prisma.organization.findMany({
            select: {
              id: true,
              googleSheetsSpreadsheetId: true,
              googleSheetsCredentials: true,
            },
            where: {
              googleSheetsSpreadsheetId: { not: null },
              googleSheetsCredentials: { not: null },
            },
          });

          if (organizations.length === 0) {
            console.log(
              "No organizations with Google Sheets configured found."
            );
            return;
          }

          // Process organizations in parallel with rate limiting
          await Promise.all(
            organizations.map(async (org, index) => {
              // Add a small delay to avoid hitting API rate limits
              await rateLimit(index * 100); // 100ms delay between requests
              try {
                const result = await ToolsService.addQaPairsToGoogleSheets(
                  org.id
                );
                console.log(
                  `✅ Successfully synced Q&A pairs for organization ${org.id}:`,
                  result.message
                );
              } catch (error: any) {
                console.error(
                  `❌ Failed to sync Q&A pairs for organization ${org.id}:`,
                  error.message
                );
              }
            })
          );
        } catch (error: any) {
          console.error(
            "❌ Error during scheduled Q&A pairs sync:",
            error.message
          );
        }
      },
      { timezone: "Asia/Dhaka" }
    );
  } catch (err) {
    console.log("❌ Error starting server:", err);
  }
};

const shutdown = () => {
  console.log("🛑 Shutting down servers...");

  // if (expirationJob) {
  //   expirationJob.stop();
  //   console.log("Subscription expiration job stopped.");
  // }

  if (server) {
    server.close(() => {
      console.log("Servers closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("unhandledRejection", () => {
  console.log(`❌ unhandledRejection is detected, shutting down...`);
  shutdown();
});

process.on("uncaughtException", () => {
  console.log(`❌ uncaughtException is detected, shutting down...`);
  shutdown();
});

main();
