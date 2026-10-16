export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

export interface RemoteInfo {
  provider: GitProvider;
  ownerRepo: string;
  webOrigin: string;
}

/** Parse HTTPS, SCP-style SSH, and ssh:// Git remote URLs. */
export function parseRemoteUrl(url: string): RemoteInfo {
  let host = '';
  let path = '';
  const sshRe = /^git@([^:]+):(.+?)(?:\.git)?$/;
  const httpsRe = /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/;
  const sshUrlRe = /^ssh:\/\/git@([^:/]+)(?::\d+)?\/(.+?)(?:\.git)?$/;
  const match = sshRe.exec(url) ?? httpsRe.exec(url) ?? sshUrlRe.exec(url);
  if (match) {
    host = match[1] ?? '';
    path = match[2] ?? '';
  }

  const provider: GitProvider = /github\./i.test(host)
    ? 'github'
    : /gitlab\./i.test(host)
      ? 'gitlab'
      : /bitbucket\./i.test(host)
        ? 'bitbucket'
        : 'unknown';
  return { provider, ownerRepo: path, webOrigin: host ? `https://${host}` : '' };
}

export function buildCompareUrl(
  remote: RemoteInfo,
  headBranch: string,
  baseBranch?: string,
): string | null {
  if (!remote.webOrigin || !remote.ownerRepo) return null;
  const head = encodeURIComponent(headBranch);
  const base = baseBranch ? encodeURIComponent(baseBranch) : '';
  switch (remote.provider) {
    case 'github':
      return base
        ? `${remote.webOrigin}/${remote.ownerRepo}/compare/${base}...${head}?expand=1`
        : `${remote.webOrigin}/${remote.ownerRepo}/compare/${head}?expand=1`;
    case 'gitlab':
      return base
        ? `${remote.webOrigin}/${remote.ownerRepo}/-/merge_requests/new?merge_request[source_branch]=${head}&merge_request[target_branch]=${base}`
        : `${remote.webOrigin}/${remote.ownerRepo}/-/merge_requests/new?merge_request[source_branch]=${head}`;
    case 'bitbucket':
      return base
        ? `${remote.webOrigin}/${remote.ownerRepo}/pull-requests/new?source=${head}&dest=${base}`
        : `${remote.webOrigin}/${remote.ownerRepo}/pull-requests/new?source=${head}`;
    case 'unknown':
      return null;
  }
}

export function buildCommitUrl(remote: RemoteInfo, sha: string): string | null {
  if (!remote.webOrigin || !remote.ownerRepo || !sha) return null;
  switch (remote.provider) {
    case 'github':
      return `${remote.webOrigin}/${remote.ownerRepo}/commit/${sha}`;
    case 'gitlab':
      return `${remote.webOrigin}/${remote.ownerRepo}/-/commit/${sha}`;
    case 'bitbucket':
      return `${remote.webOrigin}/${remote.ownerRepo}/commits/${sha}`;
    case 'unknown':
      return null;
  }
}
