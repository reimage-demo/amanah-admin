import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const repository = 'https://github.com/reimage-demo/amanah-admin.git';
const destination = mkdtempSync(join(tmpdir(), 'amanah-pages-'));
function git(args) { return execFileSync('git', args, { cwd: destination, encoding: 'utf8' }); }
try {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  const existing = execFileSync('git', ['ls-remote', repository, 'refs/heads/gh-pages'], { encoding: 'utf8' }).trim();
  if (existing) {
    git(['clone', '--depth', '1', '--single-branch', '--branch', 'gh-pages', repository, '.']);
    for (const file of readdirSync(destination)) if (file !== '.git') rmSync(join(destination, file), { recursive: true, force: true });
  } else {
    git(['init', '-b', 'gh-pages']);
    git(['remote', 'add', 'origin', repository]);
  }
  cpSync(resolve('dist'), destination, { recursive: true });
  writeFileSync(join(destination, '.nojekyll'), '');
  git(['add', '--all']);
  if (git(['status', '--porcelain']).trim()) {
    git(['-c', 'user.name=Amanah Deployment', '-c', 'user.email=deployment@users.noreply.github.com', 'commit', '-m', 'Publish Amanah Vite production build']);
    git(['push', 'origin', 'HEAD:gh-pages']);
  }
  console.log('Published built frontend to reimage-demo/amanah-admin:gh-pages.');
} finally {
  rmSync(destination, { recursive: true, force: true });
}
