$Host.UI.RawUI.WindowTitle = "Tangerine Invoicing - No cerrar esta ventana"
Set-Location $PSScriptRoot

Clear-Host
Write-Host ""
Write-Host "  ================================================" -ForegroundColor DarkYellow
Write-Host "   Tangerine Studios  --  Sistema de Facturacion" -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor DarkYellow
Write-Host ""

if (-not (Test-Path "node_modules")) {
    Write-Host "  Primera vez detectada. Instalando dependencias..." -ForegroundColor Cyan
    Write-Host "  Esto puede tardar unos minutos, por favor espera." -ForegroundColor Cyan
    Write-Host ""
    npm install
    npm install --prefix client
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================" -ForegroundColor DarkYellow
    Write-Host "   Tangerine Studios  --  Sistema de Facturacion" -ForegroundColor Yellow
    Write-Host "  ================================================" -ForegroundColor DarkYellow
    Write-Host ""
}

Write-Host "  Preparando la aplicacion..." -ForegroundColor Cyan
npm run build --prefix client --silent
Write-Host "  Listo." -ForegroundColor Cyan
Write-Host ""

# Si el puerto 3001 ya esta en uso, matar el proceso anterior
$existing = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Cerrando instancia anterior en puerto 3001..." -ForegroundColor DarkYellow
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

$null = Start-Job -ScriptBlock { Start-Sleep 2; Start-Process "http://localhost:3001" }

Write-Host "  Servidor iniciado en: " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "  El navegador se abrira en unos segundos..." -ForegroundColor Gray
Write-Host ""
Write-Host "  IMPORTANTE: No cierres esta ventana mientras uses la app." -ForegroundColor Red
Write-Host "  Para apagar la aplicacion, cierra esta ventana." -ForegroundColor Red
Write-Host ""
Write-Host "  ------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

node server.js

Write-Host ""
Write-Host "  El servidor se detuvo." -ForegroundColor Red
Write-Host ""
Read-Host "  Presiona Enter para cerrar"
