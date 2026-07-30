$sshDir = Join-Path $env:USERPROFILE '.ssh'
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}
$knownHosts = Join-Path $sshDir 'known_hosts'
# 先用临时文件接收 keyscan 输出
$tmpFile = Join-Path $env:TEMP 'gh_keyscan_tmp'
ssh-keyscan -t ecdsa github.com 2>$null | Out-File -FilePath $tmpFile -Encoding utf8
if (Test-Path $tmpFile) {
    $content = Get-Content $tmpFile -Raw
    if ($content) {
        Add-Content -Path $knownHosts -Value $content
        Write-Host "GitHub SSH host key added to $knownHosts"
    }
    Remove-Item $tmpFile -Force
}
