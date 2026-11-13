import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("drop unanswered questions", { minutes: 1 }, internal.jobs.sweep, {});
crons.interval("delete expired shares", { hours: 1 }, internal.shares.sweep, {});
export default crons;
