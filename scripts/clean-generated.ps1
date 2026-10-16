# Preview by default. Run with -Apply only after reviewing the printed paths.
[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($taskVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid package version' }
$taskRelease = Join-Path $taskRoot 'release'
$taskPortable = Join-Path $taskRelease "v$taskVersion\WDWorld-Desktop-$taskVersion"
$taskCandidates = @('coverage', 'test-results', 'start.log', 'public\sql-wasm.wasm') |
  ForEach-Object { Join-Path $taskRoot $_ }

# Only offer obsolete releases if a verified current portable build exists.
if (Test-Path -LiteralPath (Join-Path $taskPortable 'WD World.exe')) {
  $taskManifest = Get-Content -LiteralPath (Join-Path $taskPortable 'resources\app\package.json') -Raw | ConvertFrom-Json
  if ($taskManifest.version -ne $taskVersion) { throw 'Portable version mismatch' }
  $taskCandidates += Get-ChildItem -LiteralPath $taskRelease -Directory |
    Where-Object {
      $_.Name -ne "v$taskVersion" -and
      ($_.Name -match '^v\d+\.\d+\.\d+$' -or $_.Name -match '^WDWorld-Desktop-\d+\.\d+\.\d+$')
    } | ForEach-Object FullName
} else {
  Write-Warning 'Current portable build is missing; preserving all desktop builds.'
}

$taskInstaller = Join-Path $taskRelease 'installer'
if (Test-Path -LiteralPath (Join-Path $taskInstaller "WDWorld-Setup-$taskVersion.exe")) {
  $taskCandidates += Join-Path $taskInstaller 'win-unpacked'
  $taskCandidates += Get-ChildItem -LiteralPath $taskInstaller -File |
    Where-Object {
      $_.Name -match '^WDWorld-Setup-\d+\.\d+\.\d+\.exe(\.blockmap)?$' -and
      $_.Name -notlike "WDWorld-Setup-$taskVersion.exe*"
    } | ForEach-Object FullName
}

# Validate the entire list before deleting anything. No links or user data.
$taskChecked = @(
  foreach ($taskCandidate in $taskCandidates) {
    if (-not (Test-Path -LiteralPath $taskCandidate)) { continue }
    $taskResolved = (Resolve-Path -LiteralPath $taskCandidate).Path
    if (-not $taskResolved.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
      throw "Outside workspace: $taskResolved"
    }
    $taskItem = Get-Item -LiteralPath $taskResolved -Force
    $taskAncestor = $taskItem
    while ($taskAncestor.FullName -ne $taskRoot) {
      if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Refusing linked path: $($taskAncestor.FullName)"
      }
      $taskAncestor = Get-Item -LiteralPath (Split-Path -Parent $taskAncestor.FullName) -Force
    }
    $taskItems = @($taskItem)
    if ($taskItem.PSIsContainer) {
      $taskItems += Get-ChildItem -LiteralPath $taskResolved -Recurse -Force
    }
    if ($taskItems | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
      throw "Refusing reparse point inside: $taskResolved"
    }
    if ($taskItems | Where-Object {
      $_.Name -like '*.wdw*' -or $_.Name -eq 'ai-settings.json' -or
      $_.Name -in @('userData', 'Local Storage', 'Session Storage', 'Cookies')
    }) { throw "Possible user data inside: $taskResolved" }
    [pscustomobject]@{
      Path = $taskResolved
      Bytes = [long](($taskItems | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum)
    }
  }
)
$taskChecked | Select-Object Path, @{Name='MiB'; Expression={[math]::Round($_.Bytes / 1MB, 2)}} | Format-Table -AutoSize
$taskTotal = ($taskChecked | Measure-Object Bytes -Sum).Sum
Write-Output ('Candidate total: {0:N2} GiB' -f ($taskTotal / 1GB))
if (-not $Apply) {
  Write-Output 'Preview only. No files removed. Review paths, then run with -Apply.'
  return
}
$taskRemoved = 0
foreach ($taskEntry in $taskChecked) {
  if ($PSCmdlet.ShouldProcess($taskEntry.Path, 'Delete generated files permanently')) {
    Remove-Item -LiteralPath $taskEntry.Path -Recurse -Force -ErrorAction Stop
    $taskRemoved += $taskEntry.Bytes
  }
}
Write-Output ('Removed: {0:N2} GiB' -f ($taskRemoved / 1GB))
