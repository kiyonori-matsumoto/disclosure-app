import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  fetchCloudRunRevisions,
  saveRevisionsBackup,
  runRecordRevisions,
} from "../cd/recordRevisions";
import { rollbackServices } from "../cd/rollbackRevisions";
import {
  runSmokeTests,
  getDefaultSmokeTestTargets,
} from "../cd/smokeTest";
import { main } from "../cd/cli";

describe("CD Automated Rollback & Pipeline Suite", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cd-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("recordRevisions", () => {
    it("should extract revisions from active traffic or latestReadyRevisionName", () => {
      const mockServices = [
        {
          metadata: { name: "checknewdisclosure2" },
          status: {
            traffic: [
              { percent: 100, revisionName: "checknewdisclosure2-00001-baw" },
            ],
            latestReadyRevisionName: "checknewdisclosure2-00001-baw",
          },
        },
        {
          metadata: { name: "listtopicsv2" },
          status: {
            traffic: [],
            latestReadyRevisionName: "listtopicsv2-00002-abc",
          },
        },
        {
          metadata: { name: "unknown-svc" },
          status: {},
        },
      ];

      const mockExec = jest.fn().mockReturnValue(JSON.stringify(mockServices));
      const revisions = fetchCloudRunRevisions("disclosure-app", "asia-northeast1", mockExec);

      expect(mockExec).toHaveBeenCalledWith(
        "gcloud run services list --project=disclosure-app --region=asia-northeast1 --format=json"
      );
      expect(revisions).toEqual({
        checknewdisclosure2: "checknewdisclosure2-00001-baw",
        listtopicsv2: "listtopicsv2-00002-abc",
      });
    });

    it("should handle gcloud execution error gracefully", () => {
      const mockExec = jest.fn().mockImplementation(() => {
        throw new Error("Command failed: gcloud not found");
      });

      const revisions = fetchCloudRunRevisions("disclosure-app", "asia-northeast1", mockExec);
      expect(revisions).toEqual({});
    });

    it("should handle invalid JSON output gracefully", () => {
      const mockExec = jest.fn().mockReturnValue("not-valid-json");
      const revisions = fetchCloudRunRevisions("disclosure-app", "asia-northeast1", mockExec);
      expect(revisions).toEqual({});
    });

    it("should save and load revisions backup file properly", () => {
      const backupPath = path.join(tmpDir, "sub", "revisions.json");
      const sampleRevisions = {
        checknewdisclosure2: "checknewdisclosure2-00001-baw",
      };

      const backup = saveRevisionsBackup(backupPath, "disclosure-app", "asia-northeast1", sampleRevisions);
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(backup.services).toEqual(sampleRevisions);
      expect(backup.projectId).toBe("disclosure-app");
      expect(backup.region).toBe("asia-northeast1");

      const fileContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
      expect(fileContent.services).toEqual(sampleRevisions);
    });

    it("should run runRecordRevisions end-to-end with mock exec", () => {
      const backupPath = path.join(tmpDir, "revisions.json");
      const mockExec = jest.fn().mockReturnValue(
        JSON.stringify([
          {
            metadata: { name: "test-service" },
            status: { latestReadyRevisionName: "test-service-00001" },
          },
        ])
      );

      const result = runRecordRevisions(backupPath, "disclosure-app", "asia-northeast1", mockExec);
      expect(result.services).toEqual({ "test-service": "test-service-00001" });
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe("rollbackRevisions", () => {
    it("should return early if backup file does not exist", () => {
      const res = rollbackServices(path.join(tmpDir, "nonexistent.json"));
      expect(res.total).toBe(0);
      expect(res.succeeded).toBe(0);
      expect(res.failed).toBe(0);
    });

    it("should return early if backup file has corrupted JSON", () => {
      const badPath = path.join(tmpDir, "bad.json");
      fs.writeFileSync(badPath, "corrupt json{{{", "utf-8");
      const res = rollbackServices(badPath);
      expect(res.total).toBe(0);
    });

    it("should execute gcloud rollback for each service in backup", () => {
      const backupPath = path.join(tmpDir, "revisions.json");
      fs.writeFileSync(
        backupPath,
        JSON.stringify({
          projectId: "disclosure-app",
          region: "asia-northeast1",
          services: {
            checknewdisclosure2: "checknewdisclosure2-00001-baw",
            listtopicsv2: "listtopicsv2-00001-xyz",
          },
        }),
        "utf-8"
      );

      const mockExec = jest.fn();
      const res = rollbackServices(backupPath, mockExec);

      expect(res.total).toBe(2);
      expect(res.succeeded).toBe(2);
      expect(res.failed).toBe(0);
      expect(mockExec).toHaveBeenCalledWith(
        "gcloud run services update-traffic checknewdisclosure2 --to-revisions=checknewdisclosure2-00001-baw=100 --project=disclosure-app --region=asia-northeast1"
      );
      expect(mockExec).toHaveBeenCalledWith(
        "gcloud run services update-traffic listtopicsv2 --to-revisions=listtopicsv2-00001-xyz=100 --project=disclosure-app --region=asia-northeast1"
      );
    });

    it("should track and report partial failures during rollback", () => {
      const backupPath = path.join(tmpDir, "revisions.json");
      fs.writeFileSync(
        backupPath,
        JSON.stringify({
          projectId: "disclosure-app",
          region: "asia-northeast1",
          services: {
            ok_service: "ok-001",
            fail_service: "fail-001",
          },
        }),
        "utf-8"
      );

      const mockExec = jest.fn().mockImplementation((cmd: string) => {
        if (cmd.includes("fail_service")) {
          throw new Error("GCloud revision not found");
        }
      });

      const res = rollbackServices(backupPath, mockExec);
      expect(res.total).toBe(2);
      expect(res.succeeded).toBe(1);
      expect(res.failed).toBe(1);
      expect(res.results.find((r) => r.service === "fail_service")?.success).toBe(false);
    });
  });

  describe("smokeTest", () => {
    it("should pass when endpoint returns acceptable status code", async () => {
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ status: 400, data: "Missing required parameter" }),
      };

      const targets = [
        {
          name: "listTopicsV2",
          url: "https://asia-northeast1-disclosure-app.cloudfunctions.net/listTopicsV2",
          expectedStatusMin: 200,
          expectedStatusMax: 499,
        },
      ];

      const res = await runSmokeTests(targets, mockHttpClient);
      expect(res.passed).toBe(true);
      expect(res.results[0].status).toBe(400);
      expect(res.results[0].passed).toBe(true);
    });

    it("should fail when endpoint returns 500 server error", async () => {
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ status: 500, data: "Internal Server Error" }),
      };

      const targets = [
        {
          name: "listTopicsV2",
          url: "https://asia-northeast1-disclosure-app.cloudfunctions.net/listTopicsV2",
          expectedStatusMin: 200,
          expectedStatusMax: 499,
        },
      ];

      const res = await runSmokeTests(targets, mockHttpClient);
      expect(res.passed).toBe(false);
      expect(res.results[0].passed).toBe(false);
    });

    it("should fail when network request errors out", async () => {
      const mockHttpClient = {
        get: jest.fn().mockRejectedValue(new Error("Connection refused")),
      };

      const targets = [
        {
          name: "listTopicsV2",
          url: "https://asia-northeast1-disclosure-app.cloudfunctions.net/listTopicsV2",
          expectedStatusMin: 200,
          expectedStatusMax: 499,
        },
      ];

      const res = await runSmokeTests(targets, mockHttpClient);
      expect(res.passed).toBe(false);
      expect(res.results[0].error).toContain("Connection refused");
    });

    it("should generate default targets with specified project and region", () => {
      const targets = getDefaultSmokeTestTargets("custom-proj", "asia-northeast1");
      expect(targets.length).toBe(2);
      expect(targets[0].url).toBe(
        "https://asia-northeast1-custom-proj.cloudfunctions.net/listTopicsV2"
      );
      expect(targets[1].url).toBe(
        "https://asia-northeast1-custom-proj.cloudfunctions.net/getDownloadUrlEdinetV2"
      );
    });
  });

  describe("cli", () => {
    it("should return 1 on unknown action", async () => {
      const code = await main("unknown-action", "test", "asia-northeast1", path.join(tmpDir, "b.json"));
      expect(code).toBe(1);
    });

    it("should execute record action via cli", async () => {
      const backupPath = path.join(tmpDir, "cli-revisions.json");
      // mock gcloud via empty output
      const code = await main("record", "test-proj", "asia-northeast1", backupPath);
      expect(code).toBe(0);
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });
});
