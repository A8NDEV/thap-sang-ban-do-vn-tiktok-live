# Them ten mien rieng cho OBS / TikTok LIVE Studio tro ve may nay vao file hosts (can quyen quan tri - trang dieu khien tu mo hop UAC).
# Chi them dung ten mien cua tool (mac dinh thapsang.test), khong dung toi ten mien nao khac.
param([string]$Domain = 'thapsang.test')
if ($Domain -notmatch '^[a-z0-9-]+\.test$') { Write-Host "Ten mien khong hop le: $Domain"; exit 1 }
$hosts = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'
$pattern = '^\s*127\.0\.0\.1\s+' + [regex]::Escape($Domain) + '(\s|$)'
if (-not (Get-Content $hosts -ErrorAction SilentlyContinue | Where-Object { $_ -match $pattern })) {
    Add-Content -Path $hosts -Value "`r`n127.0.0.1`t$Domain`t# Thap Sang Ban Do" -Encoding ascii
    Write-Host "Da them: $Domain"
} else { Write-Host "Da co: $Domain" }
ipconfig /flushdns | Out-Null
