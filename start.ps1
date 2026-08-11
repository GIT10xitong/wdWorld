# WD World browser launcher and local static server.
param(
  [switch]$Serve,
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$webRoot = Join-Path $scriptDir "dist"
$serverUrl = "http://127.0.0.1:$Port/"
$logFile = Join-Path $scriptDir "start.log"

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Test-LocalServer {
  try {
    $request = [System.Net.HttpWebRequest]::Create($serverUrl)
    $request.Method = "HEAD"
    $request.Timeout = 1000
    $response = $request.GetResponse()
    $response.Close()
    return $true
  } catch {
    return $false
  }
}

function Start-StaticServer {
  if (-not (Test-Path -LiteralPath (Join-Path $webRoot "index.html") -PathType Leaf)) {
    throw "Build output is missing: $webRoot\index.html"
  }

  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add($serverUrl)
  $mimeTypes = @{
    ".css" = "text/css; charset=utf-8"; ".gif" = "image/gif"
    ".html" = "text/html; charset=utf-8"; ".ico" = "image/x-icon"
    ".jpeg" = "image/jpeg"; ".jpg" = "image/jpeg"
    ".js" = "text/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8"
    ".map" = "application/json; charset=utf-8"; ".png" = "image/png"
    ".svg" = "image/svg+xml"; ".txt" = "text/plain; charset=utf-8"
    ".wasm" = "application/wasm"; ".webp" = "image/webp"
  }

  try {
    $listener.Start()
    Write-Log "Static server started at $serverUrl"
    $fullWebRoot = [System.IO.Path]::GetFullPath($webRoot).TrimEnd("\") + "\"

    while ($listener.IsListening) {
      $context = $null
      try {
        $context = $listener.GetContext()
        $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = "index.html" }

        $targetPath = [System.IO.Path]::GetFullPath((Join-Path $webRoot $requestPath))
        if (-not $targetPath.StartsWith($fullWebRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
          $context.Response.StatusCode = 403
          $context.Response.Close()
          continue
        }

        if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
          if ([string]::IsNullOrWhiteSpace([System.IO.Path]::GetExtension($requestPath))) {
            $targetPath = Join-Path $webRoot "index.html"
          } else {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
          }
        }

        $extension = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
        $contentType = $mimeTypes[$extension]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($targetPath)
        $context.Response.ContentType = $contentType
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.Headers["Cache-Control"] = "no-cache"
        if ($context.Request.HttpMethod -ne "HEAD") {
          $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $context.Response.OutputStream.Close()
      } catch {
        Write-Log "Request failed: $($_.Exception.Message)"
        if ($context -and $context.Response) {
          try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
        }
      }
    }
  } finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    Write-Log "Static server stopped"
  }
}

Set-Location -LiteralPath $scriptDir

if ($Serve) {
  try { Start-StaticServer; exit 0 }
  catch { Write-Log "Server failed: $($_.Exception.Message)"; exit 1 }
}

try {
  Set-Content -LiteralPath $logFile -Value "WD World launcher" -Encoding UTF8
  Write-Log "Project directory: $scriptDir"

  $npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npm) {
    Write-Host "Building WD World..."
    Write-Log "Running npm.cmd run build"
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
    Write-Log "Build completed"
  } elseif (-not (Test-Path -LiteralPath (Join-Path $webRoot "index.html") -PathType Leaf)) {
    throw "npm.cmd was not found and no existing build is available"
  } else {
    Write-Log "npm.cmd not found; using existing dist build"
  }

  if (-not (Test-LocalServer)) {
    Write-Host "Starting local server..."
    $serverArguments = @(
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-File", "`"$PSCommandPath`"", "-Serve", "-Port", $Port
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $serverArguments -WindowStyle Hidden | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
      Start-Sleep -Milliseconds 250
      if (Test-LocalServer) { $ready = $true; break }
    }
    if (-not $ready) { throw "Local server did not become ready at $serverUrl" }
  } else {
    Write-Log "Reusing server at $serverUrl"
  }

  Write-Host "Opening $serverUrl"
  Write-Log "Opening browser"
  Start-Process $serverUrl
  exit 0
} catch {
  $message = $_.Exception.Message
  Write-Host ""
  Write-Host "WD World failed to start: $message" -ForegroundColor Red
  Write-Log "Launcher failed: $message"
  exit 1
}
