import * as fs from "fs";
import * as path from "path";

describe("CI/CD Workflow and Scripts Verification", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const ciPath = path.join(rootDir, ".github/workflows/ci.yml");
  const packageJsonPath = path.join(rootDir, "functions/package.json");
  const deployPath = path.join(rootDir, ".github/workflows/deploy.yml");

  it("should have .github/workflows/ci.yml configured properly", () => {
    expect(fs.existsSync(ciPath)).toBe(true);
    const content = fs.readFileSync(ciPath, "utf-8");

    // Check triggers
    expect(content).toMatch(/push:/);
    expect(content).toMatch(/pull_request:/);
    expect(content).toMatch(/branches:\s*\[.*main.*master.*\]/);

    // Check environment
    expect(content).toMatch(/working-directory:\s*\.\/functions/);
    expect(content).toMatch(/node-version:\s*['"]22['"]/);

    // Check key steps
    expect(content).toMatch(/npm ci/);
    expect(content).toMatch(/npm run lint/);
    expect(content).toMatch(/npm run type-check/);
    expect(content).toMatch(/npm run build/);
    expect(content).toMatch(/npm test/);
    expect(content).toMatch(/npm run audit/);
    expect(content).toMatch(/continue-on-error:\s*true/);
  });

  it("should have standard npm scripts defined in functions/package.json", () => {
    expect(fs.existsSync(packageJsonPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts["lint"]).toBe("eslint .");
    expect(pkg.scripts["type-check"]).toBe("tsc --noEmit");
    expect(pkg.scripts["build"]).toContain("npm run lint");
    expect(pkg.scripts["build"]).toContain("npm run type-check");
    expect(pkg.scripts["build"]).toContain("tsc");
    expect(pkg.scripts["test"]).toContain("jest");
    expect(pkg.scripts["audit"]).toBe("npm audit --audit-level=high");
  });

  it("should have .github/workflows/deploy.yml configured for simple, reliable deploy", () => {
    expect(fs.existsSync(deployPath)).toBe(true);
    const content = fs.readFileSync(deployPath, "utf-8");

    expect(content).toMatch(/name:\s*Deploy/);
    expect(content).toMatch(/workflow_dispatch:/);
    expect(content).toMatch(/push:\s*branches:\s*\[\s*master\s*\]/);
    expect(content).toMatch(/npm run build/);
    expect(content).toMatch(/npm test/);
    expect(content).toMatch(/firebase-tools deploy/);
  });
});
