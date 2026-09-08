DO $$
BEGIN
  IF to_regclass('public."Business"') IS NULL THEN
    RAISE EXCEPTION 'Refusing ClientFlow cleanup: target is not the platform database.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '20260821120000_clientflow_baseline'
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Refusing ClientFlow cleanup: ClientFlow migration history detected.';
  END IF;
END $$;

DROP TABLE IF EXISTS "CfEnrollmentMonitoringEvidence" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentMonitoringHistory" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentMonitoring" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentCheckpointEvidence" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentProgressCheckpoint" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentProgressTrack" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentProgressPlan" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentGoal" CASCADE;
DROP TABLE IF EXISTS "CfMonitoringRequirement" CASCADE;
DROP TABLE IF EXISTS "CfProgramMonitoringTemplateVersion" CASCADE;
DROP TABLE IF EXISTS "CfProgramGoalCategory" CASCADE;
DROP TABLE IF EXISTS "CfProgramProgressCheckpoint" CASCADE;
DROP TABLE IF EXISTS "CfProgramProgressTrack" CASCADE;
DROP TABLE IF EXISTS "CfProgramProgressTemplateVersion" CASCADE;
DROP TABLE IF EXISTS "CfMonitoringItem" CASCADE;
DROP TABLE IF EXISTS "CfIntakeSubmissionProgram" CASCADE;
DROP TABLE IF EXISTS "CfIntakeSubmissionSnapshot" CASCADE;
DROP TABLE IF EXISTS "CfIntakeRenderSession" CASCADE;
DROP TABLE IF EXISTS "CfEnrollmentStatusHistory" CASCADE;
DROP TABLE IF EXISTS "CfTask" CASCADE;
DROP TABLE IF EXISTS "CfNotification" CASCADE;
DROP TABLE IF EXISTS "CfActivityLog" CASCADE;
DROP TABLE IF EXISTS "CfFinalReport" CASCADE;
DROP TABLE IF EXISTS "CfCommunication" CASCADE;
DROP TABLE IF EXISTS "CfDocument" CASCADE;
DROP TABLE IF EXISTS "CfContract" CASCADE;
DROP TABLE IF EXISTS "CfTerms" CASCADE;
DROP TABLE IF EXISTS "CfIntakeSubmission" CASCADE;
DROP TABLE IF EXISTS "CfFormAssignment" CASCADE;
DROP TABLE IF EXISTS "CfFormTemplate" CASCADE;
DROP TABLE IF EXISTS "CfProgramEnrollment" CASCADE;
DROP TABLE IF EXISTS "CfProgram" CASCADE;
DROP TABLE IF EXISTS "CfClient" CASCADE;