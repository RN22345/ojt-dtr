# Runbook 6.3, step 2 (TC-ST-Q-RE-04): makes data.sql of a backup ready for a new database.
# - It removes the COPY blocks of auth session and token tables. After a rebuild, all users log in again.
# - It removes the COPY blocks of empty auth tables. The target Auth version can have other columns.
# - It empties ops.server_meta and ops.settings first. The migrations write these rows.
# Usage: python -I ops/prepare-restore.py data.sql data-restore.sql
import re
import sys

SKIP = {'audit_log_entries', 'flow_state', 'sessions', 'refresh_tokens', 'one_time_tokens', 'mfa_amr_claims',
        'mfa_challenges', 'oauth_authorizations', 'oauth_client_states', 'oauth_consents',
        'webauthn_challenges', 'saml_relay_states'}

END = chr(92) + '.'  # the end line of a COPY block
lines = open(sys.argv[1], encoding='utf-8').read().split('\n')
out = ['truncate ops.server_meta, ops.settings;']
i = 0
while i < len(lines):
    m = re.match(r'COPY "(\w+)"\."(\w+)"', lines[i])
    if m and m.group(1) == 'auth':
        j = i + 1
        while lines[j] != END:
            j += 1
        if m.group(2) in SKIP or j == i + 1:
            i = j + 1
            continue
    out.append(lines[i])
    i += 1
open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
