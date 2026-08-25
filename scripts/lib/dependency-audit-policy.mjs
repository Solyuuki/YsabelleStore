export function classifyAuditVulnerabilities(report, lockfile) {
  const developmentOnly = [];
  const productionReachable = [];
  const { development, production } = dependencyGraphs(lockfile);

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    const nodes = vulnerability.nodes ?? [];
    const isDevelopmentOnly =
      nodes.length > 0 &&
      nodes.every((nodePath) => {
        const metadata = lockfile.packages?.[nodePath];
        return metadata && development.has(nodePath) && !production.has(nodePath);
      });
    const finding = {
      name,
      severity: vulnerability.severity,
      direct: vulnerability.isDirect === true,
      nodes
    };

    (isDevelopmentOnly ? developmentOnly : productionReachable).push(finding);
  }

  return { developmentOnly, productionReachable };
}

export function assertCompleteAuditReport(report, status) {
  if (!isRecord(report)) {
    throw new Error("npm audit returned an incomplete report.");
  }

  if (isRecord(report.error)) {
    const code = typeof report.error.code === "string" ? report.error.code : "unknown error";
    throw new Error(`npm audit failed: ${code}.`);
  }

  if (status !== 0 && status !== 1) {
    throw new Error(`npm audit failed with unexpected exit code ${status}.`);
  }

  if (!Number.isInteger(report.auditReportVersion)) {
    throw new Error("npm audit report version is missing or invalid.");
  }

  if (!isRecord(report.vulnerabilities)) {
    throw new Error("npm audit vulnerabilities are missing or invalid.");
  }

  if (!isRecord(report.metadata) || !isRecord(report.metadata.vulnerabilities)) {
    throw new Error("npm audit metadata is missing or invalid.");
  }

  if (!Number.isFinite(report.metadata.vulnerabilities.total)) {
    throw new Error("npm audit vulnerability totals are missing or invalid.");
  }

  const reportedFindingCount = Object.keys(report.vulnerabilities).length;
  if (report.metadata.vulnerabilities.total !== reportedFindingCount) {
    throw new Error(
      `npm audit report has an inconsistent vulnerability total: expected ${report.metadata.vulnerabilities.total}, received ${reportedFindingCount}.`
    );
  }
}

function dependencyGraphs(lockfile) {
  const packages = isRecord(lockfile?.packages) ? lockfile.packages : {};
  const root = isRecord(packages[""]) ? packages[""] : {};
  const roots = [
    "",
    ...(Array.isArray(root.workspaces)
      ? root.workspaces.filter((workspace) => typeof workspace === "string" && packages[workspace])
      : [])
  ];
  const production = traverseDependencies(packages, roots, [
    "dependencies",
    "optionalDependencies"
  ]);
  const developmentSeeds = roots.flatMap((rootPath) =>
    dependencyPathsForSections(packages, rootPath, ["devDependencies"])
  );
  const development = traverseDependencies(packages, developmentSeeds, [
    "dependencies",
    "optionalDependencies",
    "peerDependencies"
  ]);

  return { development, production };
}

function traverseDependencies(packages, seeds, sections) {
  const reachable = new Set();
  const pending = [...seeds];

  while (pending.length > 0) {
    const packagePath = pending.shift();
    if (reachable.has(packagePath)) continue;

    const metadata = packages[packagePath];
    if (!isRecord(metadata)) continue;
    reachable.add(packagePath);

    for (const dependencyPath of dependencyPathsForSections(packages, packagePath, sections)) {
      if (!reachable.has(dependencyPath)) {
        pending.push(dependencyPath);
      }
    }
  }

  return reachable;
}

function dependencyPathsForSections(packages, packagePath, sections) {
  const metadata = packages[packagePath];
  if (!isRecord(metadata)) return [];

  const paths = [];
  for (const section of sections) {
    const dependencies = metadata[section];
    if (!isRecord(dependencies)) continue;

    for (const dependencyName of Object.keys(dependencies)) {
      const dependencyPath = resolveDependencyPath(packagePath, dependencyName, packages);
      if (dependencyPath) paths.push(dependencyPath);
    }
  }
  return paths;
}

function resolveDependencyPath(packagePath, dependencyName, packages) {
  let currentPath = packagePath;

  while (true) {
    const candidate = currentPath
      ? `${currentPath}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    if (!currentPath) return null;

    const separatorIndex = currentPath.lastIndexOf("/");
    currentPath = separatorIndex >= 0 ? currentPath.slice(0, separatorIndex) : "";
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
