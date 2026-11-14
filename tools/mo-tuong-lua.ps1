# LIVE bang dien thoai: mo cong tool tren tuong lua Windows cho may cung Wi-Fi (chep tu San Quay).
#   -Check : chi kiem tra (khong can quyen quan tri) -> exit 0 = on, exit 2 = can sua
#   (mac dinh): sua - can quyen quan tri (server / bat tu mo hop UAC)
# Loi hay gap: lan dau Windows hoi tuong lua, khach bam Huy -> Windows tao quy tac CHAN node.exe; quy tac chan luon thang.
param([int]$Port = 3002, [string]$Program = '', [switch]$Check)
$ErrorActionPreference = 'SilentlyContinue'
$name = "Thap Sang Ban Do $Port"
function Get-NodeBlocks {
    if (-not $Program) { return @() }
    $want = [IO.Path]::GetFullPath($Program).ToLowerInvariant()
    @(Get-NetFirewallRule -Direction Inbound -Action Block -Enabled True | Where-Object {
        $p = ($_ | Get-NetFirewallApplicationFilter).Program
        $p -and ([Environment]::ExpandEnvironmentVariables($p).ToLowerInvariant() -eq $want)
    })
}
function Test-Allow { [bool](Get-NetFirewallRule -DisplayName $name | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }) }
if ($Check) { if ((Test-Allow) -and -not (Get-NodeBlocks)) { exit 0 }; exit 2 }
if (-not (Test-Allow)) {
    Remove-NetFirewallRule -DisplayName $name
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private, Public -RemoteAddress LocalSubnet | Out-Null
}
$blocks = Get-NodeBlocks
if ($blocks) { $blocks | Disable-NetFirewallRule }
if ((Test-Allow) -and -not (Get-NodeBlocks)) { exit 0 }
exit 1
