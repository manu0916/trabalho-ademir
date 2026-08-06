const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function findBackendDir(root) {
  const candidates = [
    path.join(root, 'hardware'),
    path.join(root, '..', 'hardware'),
    path.join(root, 'backend'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'pom.xml'))) return candidate;
    } catch {
      // Try the next conventional backend location.
    }
  }
  return null;
}

function findCachedMaven() {
  const distsDir = path.join(os.homedir(), '.m2', 'wrapper', 'dists');
  const executableName = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';

  try {
    for (const distribution of fs.readdirSync(distsDir)) {
      const distributionDir = path.join(distsDir, distribution);
      for (const versionDir of fs.readdirSync(distributionDir)) {
        const executable = path.join(distributionDir, versionDir, 'bin', executableName);
        if (fs.existsSync(executable)) return executable;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function findMavenCommand(dir) {
  const executableName = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
  const configuredMaven = process.env.MAVEN_HOME
    ? path.join(process.env.MAVEN_HOME, 'bin', executableName)
    : null;
  if (configuredMaven && fs.existsSync(configuredMaven)) return { cmd: configuredMaven, args: [] };

  const cachedMaven = findCachedMaven();
  if (cachedMaven) return { cmd: cachedMaven, args: [] };

  const win = path.join(dir, 'mvnw.cmd');
  const posix = path.join(dir, 'mvnw');
  if (fs.existsSync(win)) return { cmd: win, args: [] };
  if (fs.existsSync(posix)) return { cmd: posix, args: [] };
  return { cmd: 'mvn', args: [] };
}

function spawnWithPrefix(command, args, options, prefix) {
  const child = spawn(command, args, options);
  child.stdout.on('data', (d) => {
    process.stdout.write(`[${prefix}] ${d}`);
  });
  child.stderr.on('data', (d) => {
    process.stderr.write(`[${prefix}][ERR] ${d}`);
  });
  child.on('exit', (code, signal) => {
    console.log(`[${prefix}] exited with code=${code} signal=${signal}`);
  });
  return child;
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const backendDir = process.env.BACKEND_DIR || findBackendDir(root);
  if (!backendDir || !fs.existsSync(path.join(backendDir, 'pom.xml'))) {
    console.error('Backend directory not found. Set BACKEND_DIR environment variable to the backend path.');
    process.exit(1);
  }

  console.log('Using backend dir:', backendDir);

  const mvn = findMavenCommand(backendDir);
  const mvnArgs = ['spring-boot:run'];
  console.log('Starting backend:', mvn.cmd, mvnArgs.join(' '));

  const frontendDir = path.join(root, 'loja-hardware');
  if (!fs.existsSync(path.join(frontendDir, 'package.json'))) {
    console.error('Frontend directory loja-hardware not found under', root);
    process.exit(1);
  }

  const useShell = process.platform === 'win32';
  const backend = spawnWithPrefix(mvn.cmd, mvnArgs, { cwd: backendDir, shell: useShell }, 'backend');
  console.log('Starting frontend in', frontendDir);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const frontend = spawnWithPrefix(npmCommand, ['run', 'dev'], { cwd: frontendDir, shell: useShell }, 'frontend');

  // When the main process receives a termination signal, forward to children
  const shutdown = () => {
    console.log('Shutting down children...');
    try { backend.kill(); } catch {}
    try { frontend.kill(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
