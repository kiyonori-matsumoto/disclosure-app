import "jest";
import * as fs from "fs";
import * as path from "path";

describe("Firebase Security Rules", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const firebaseJsonPath = path.join(rootDir, "firebase.json");
  const firestoreRulesPath = path.join(rootDir, "firestore.rules");
  const storageRulesPath = path.join(rootDir, "storage.rules");

  it("should configure firestore and storage rules in firebase.json", () => {
    expect(fs.existsSync(firebaseJsonPath)).toBe(true);
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf-8"));

    expect(firebaseJson.firestore).toBeDefined();
    expect(firebaseJson.firestore.rules).toBe("firestore.rules");

    expect(firebaseJson.storage).toBeDefined();
    expect(firebaseJson.storage.rules).toBe("storage.rules");
  });

  describe("firestore.rules", () => {
    let rulesContent: string;

    beforeAll(() => {
      expect(fs.existsSync(firestoreRulesPath)).toBe(true);
      rulesContent = fs.readFileSync(firestoreRulesPath, "utf-8");
    });

    it("should specify rules_version = '2'", () => {
      expect(rulesContent).toMatch(/rules_version\s*=\s*['"]2['"]/);
    });

    it("should allow public read and deny write on disclosures collection", () => {
      expect(rulesContent).toContain("match /disclosures/{disclosureId}");
      expect(rulesContent).toMatch(/match \/disclosures\/\{disclosureId\}[\s\S]*?allow read:\s*if true;/);
      expect(rulesContent).toMatch(/match \/disclosures\/\{disclosureId\}[\s\S]*?allow write:\s*if false;/);
    });

    it("should allow public read and deny write on edinets collection", () => {
      expect(rulesContent).toContain("match /edinets/{edinetId}");
      expect(rulesContent).toMatch(/match \/edinets\/\{edinetId\}[\s\S]*?allow read:\s*if true;/);
      expect(rulesContent).toMatch(/match \/edinets\/\{edinetId\}[\s\S]*?allow write:\s*if false;/);
    });

    it("should allow public read and deny write on settlements collection", () => {
      expect(rulesContent).toContain("match /settlements/{settlementId}");
      expect(rulesContent).toMatch(/match \/settlements\/\{settlementId\}[\s\S]*?allow read:\s*if true;/);
      expect(rulesContent).toMatch(/match \/settlements\/\{settlementId\}[\s\S]*?allow write:\s*if false;/);
    });

    it("should deny all operations by default for other collections (least privilege)", () => {
      expect(rulesContent).toMatch(/match\s*\/\{document=\*\*\}[\s\S]*?allow read,\s*write:\s*if false;/);
    });
  });

  describe("storage.rules", () => {
    let rulesContent: string;

    beforeAll(() => {
      expect(fs.existsSync(storageRulesPath)).toBe(true);
      rulesContent = fs.readFileSync(storageRulesPath, "utf-8");
    });

    it("should specify rules_version = '2'", () => {
      expect(rulesContent).toMatch(/rules_version\s*=\s*['"]2['"]/);
    });

    it("should allow public read and deny write for disclosures files", () => {
      expect(rulesContent).toMatch(/match \/disclosures\/\{allPaths=\*\*\}[\s\S]*?allow read:\s*if true;/);
      expect(rulesContent).toMatch(/match \/disclosures\/\{allPaths=\*\*\}[\s\S]*?allow write:\s*if false;/);
    });

    it("should allow public read and deny write for companies.json", () => {
      expect(rulesContent).toMatch(/match \/companies\.json[\s\S]*?allow read:\s*if true;/);
      expect(rulesContent).toMatch(/match \/companies\.json[\s\S]*?allow write:\s*if false;/);
    });

    it("should deny all other paths by default", () => {
      expect(rulesContent).toMatch(/match\s*\/\{allPaths=\*\*\}[\s\S]*?allow read,\s*write:\s*if false;/);
    });
  });
});
