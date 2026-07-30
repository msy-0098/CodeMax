$ports = @(7890, 7891, 1080, 10808, 10809, 8080, 33210, 2080, 4880)
foreach ($p in $ports) {
    try {
        $r = Test-NetConnection -ComputerName 127.0.0.1 -Port $p -WarningAction SilentlyContinue
        if ($r.TcpTestSucceeded) {
            Write-Host "PROXY FOUND on port $p"
        }
    } catch {}
}
Write-Host "Scan complete."
