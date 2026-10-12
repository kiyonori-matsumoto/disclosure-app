import * as functions from "firebase-functions";

/**
 * Shared structured logger wrapping firebase-functions.logger.
 * Outputs JSON format in Cloud Logging with proper severity levels
 * (DEBUG, INFO, NOTICE, WARNING, ERROR).
 */
export const logger = functions.logger;

export default logger;
