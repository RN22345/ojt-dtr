# Gate: fails if any test file changed since -Base, then runs test, typecheck, lint
# from .orchestra/config.json. -Test overrides the test command (use a task's own tests;
# omit it for the full suite). Exit 0 = pass, 1 = fail (reason on the last line).
param([Parameter(Mandatory = $true)][string]$Base, [string]$Test)

function Fail($msg) { Write-Output "GATE FAIL: $msg"; exit 1 }

$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { Fail "not inside a git repository" }
Set-Location $root
$cfg = Get-Content .orchestra/config.json -Raw | ConvertFrom-Json

git rev-parse --verify --quiet "$Base^{commit}" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "unknown base ref '$Base'" }

# 1. No test file may change (tracked diff since base + new untracked files).
$changed = @(git diff --name-only $Base) + @(git ls-files --others --exclude-standard)
$touched = @($changed | Where-Object { $f = $_; @($cfg.testPaths | Where-Object { $f -like $_ }).Count -gt 0 } | Sort-Object -Unique)
if ($touched.Count -gt 0) { Fail ("test files changed since ${Base}: " + ($touched -join ', ')) }

$stat = git diff --shortstat $Base
Write-Output "diff since ${Base}: $stat"

# 2. Test, typecheck, lint.
foreach ($step in 'test', 'typecheck', 'lint') {
    $cmd = if ($step -eq 'test' -and $Test) { $Test } else { $cfg.$step }
    if (-not $cmd) {
        if ($step -eq 'test') { Fail "no test command set in .orchestra/config.json" }
        continue
    }
    $out = cmd /c "$cmd 2>&1"
    if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE; $out | Select-Object -Last 40; Fail "$step failed (exit $code): $cmd" }
    Write-Output "ok ${step}: $cmd"
}
Write-Output "GATE PASS"
exit 0
