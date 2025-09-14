import app from "./app";
import { Server } from "http";
import config from "./app/config";
import { seedSuperAdmin } from "./seedSuperAdmin";
import cron from "node-cron";
import prisma from "./app/utils/prisma";
import { ToolsService } from "./app/modules/tools/tools.service";

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
    cron.schedule("*/10 * * * *", async () => {
      console.log("⏰ Running scheduled Q&A pairs sync to Google Sheets...");

      try {
        // Fetch all organization IDs
        const organizations = await prisma.organization.findMany({
          select: { id: true },
        });

        if (organizations.length === 0) {
          console.log("No organizations found for Q&A pairs sync.");
          return;
        }

        // Iterate over each organization and call addQaPairsToGoogleSheets
        for (const org of organizations) {
          try {
            const result = await ToolsService.addQaPairsToGoogleSheets(org.id);
            console.log(
              `✅ Successfully synced Q&A pairs for organization ${org.id}:`,
              result.message
            );
          } catch (error: any) {
            console.error(
              `❌ Failed to sync Q&A pairs for organization ${org.id}:`,
              error.message
            );
            // Continue to the next organization instead of crashing
          }
        }
      } catch (error: any) {
        console.error("❌ Error during scheduled Q&A pairs sync:", error.message);
      }
    });
  } catch (err) {
    console.log("❌ Error starting server:", err);
  }
};

// Graceful shutdown handling
const shutdown = () => {
  console.log("🛑 Shutting down servers...");

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