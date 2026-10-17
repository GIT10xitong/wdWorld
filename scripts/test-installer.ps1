param(
  [Parameter(Mandatory=$true)][string]$Installer,
  [string]$PreviousInstaller
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskInstaller = (Resolve-Path -LiteralPath $Installer).Path
if ($PreviousInstaller) { $taskPrevious = (Resolve-Path -LiteralPath $PreviousInstaller).Path }

# Do not replace a real installation or its shortcuts while doing acceptance QA.
$taskRegistryRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$taskExisting = Get-ItemProperty $taskRegistryRoots -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'WD World*' }
if ($taskExisting) { throw 'An existing WD World installation was found. Use a clean Windows test account.' }
if (Get-Process -Name 'WD World' -ErrorAction SilentlyContinue) {
  throw 'A WD World process is running. Close it before installer acceptance.'
}
foreach ($taskSpecial in @('Desktop', 'CommonDesktopDirectory', 'Programs', 'CommonPrograms')) {
  $taskShortcut = Join-Path ([Environment]::GetFolderPath($taskSpecial)) 'WD World.lnk'
  if (Test-Path -LiteralPath $taskShortcut) { throw "Existing shortcut must be preserved: $taskShortcut" }
}
$taskTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$taskInstallDir = Join-Path $taskTemp ('wdworld-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskInstallDir | Out-Null
$taskResolved = (Resolve-Path -LiteralPath $taskInstallDir).Path
if (-not $taskResolved.StartsWith($taskTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid QA directory' }
$taskExe = Join-Path $taskResolved 'WD World.exe'
$taskUninstall = Join-Path $taskResolved 'Uninstall WD World.exe'
function Install-Candidate([string]$File) {
  $taskProcess = Start-Process -FilePath $File -ArgumentList "/S /currentuser /D=$taskResolved" -WindowStyle Hidden -PassThru
  if (-not $taskProcess.WaitForExit(180000)) { $taskProcess.Kill(); throw 'Installer timed out' }
  if ($taskProcess.ExitCode -ne 0) { throw "Installer failed: $($taskProcess.ExitCode)" }
  if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Installed executable missing' }
}
$taskPreviousVersion = $null
try {
  if ($taskPrevious) {
    Install-Candidate $taskPrevious
    $taskPreviousVersion = (Get-Item -LiteralPath $taskExe).VersionInfo.ProductVersion
  }
  Install-Candidate $taskInstaller
  $taskInstalledVersion = (Get-Item -LiteralPath $taskExe).VersionInfo.ProductVersion
  # Windows PE metadata uses four components even when package.json uses SemVer.
  if ($taskInstalledVersion -notin @($taskVersion, "$taskVersion.0")) { throw "Installed version mismatch: $taskInstalledVersion" }
  $taskRegistration = Get-ItemProperty $taskRegistryRoots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'WD World*' }
  if (-not $taskRegistration -or $taskRegistration.DisplayVersion -notin @($taskVersion, "$taskVersion.0")) { throw 'Installer registration mismatch' }
  & node (Join-Path $PSScriptRoot 'test-packaged.js') $taskExe installer
  if ($LASTEXITCODE -ne 0) { throw 'Installed application acceptance failed' }
} finally {
  if (Test-Path -LiteralPath $taskUninstall) {
    $taskProcess = Start-Process -FilePath $taskUninstall -ArgumentList "/S /currentuser _?=$taskResolved" -WindowStyle Hidden -PassThru
    if (-not $taskProcess.WaitForExit(180000)) { $taskProcess.Kill(); throw 'QA uninstall timed out' }
    if ($taskProcess.ExitCode -ne 0) { throw "QA uninstall failed: $($taskProcess.ExitCode)" }
  }
}
if (Test-Path -LiteralPath $taskExe) { throw 'QA uninstall left the executable installed' }
$taskRemaining = Get-ItemProperty $taskRegistryRoots -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'WD World*' }
if ($taskRemaining) { throw 'QA uninstall left an installation registration' }
$taskReport = @{
  passed = $true
  version = $taskVersion
  previousVersion = $taskPreviousVersion
  installedDirectory = $taskResolved
  checks = @('silent per-user install', 'installed version and registration', 'packaged migration/save/restart', 'uninstall cleanup')
}
$taskReport | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'test-results/installer-acceptance.json') -Encoding UTF8
Write-Output "NSIS install, application acceptance and uninstall passed for $taskVersion"
