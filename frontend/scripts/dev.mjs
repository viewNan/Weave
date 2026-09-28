import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const configHome = join(process.cwd(), '.wrangler-config');
mkdirSync(configHome, { recursive: true });
const child = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--webpack', '--hostname', '127.0.0.1'], { stdio: 'inherit', env: { ...process.env, XDG_CONFIG_HOME: configHome } });
child.on('exit', code => process.exit(code ?? 0));
