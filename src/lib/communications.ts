export {
  buildAIGradingReadyNotification,
  buildAssignmentPublishedNotification,
  buildGradeReleasedNotification,
  buildIntegrityCheckReadyNotification,
  buildSubmissionReceivedNotification,
} from "@/lib/communicationsNotifications";
export { buildCommunicationMessageFingerprint } from "@/lib/communicationsFingerprint";
export {
  clearCommunicationMessage,
  dispatchCommunicationMessage,
  markCommunicationMessageRead,
  queueCommunicationMessage,
} from "@/lib/communicationsMessageOperations";
export {
  dispatchWorkflowNotificationEmail,
  WorkflowEmailRequestSchema,
  sendWorkflowNotificationEmail,
} from "@/lib/communicationsWorkflowEmail";
export {
  getVisibleCommunicationMessages,
  loadVisibleCommunicationMessages,
} from "@/lib/communicationsVisibility";
export type {
  CommunicationCategory,
  CommunicationDispatchResult,
  CommunicationMessage,
  CommunicationMessageClearedOnlyRow,
  CommunicationMessageLegacyRow,
  CommunicationMessageReadOnlyRow,
  CommunicationMessageRow,
  DraftCommunicationMessage,
  SupabaseLikeError,
} from "@/lib/communicationsHelpers";
