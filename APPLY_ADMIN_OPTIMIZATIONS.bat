@echo off
:: ==============================================================================
:: Administrator Optimization Launcher (v2)
:: Automatically requests UAC elevation and runs full system/RAM optimization
:: ==============================================================================
title System and RAM Optimizer - Admin Mode

:: Check for Administrator elevation
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run_script
) else (
    echo [INFO] Requesting Administrator Privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:run_script
cls
echo ==============================================================================
echo                PERFORMING COMPLETE SYSTEM & RAM OPTIMIZATIONS (v2)
echo ==============================================================================
echo.
echo Phase 1: Ultimate Performance Power Plan + CPU Min State 5%% + Wi-Fi Max Perf
echo Phase 2: Pagefile Optimization (8GB Initial, 12GB Max - Prevents Dynamic Thrashing)
echo Phase 3: Disabling Bloat Background Services (SysMain, DiagTrack, WSearch)
echo Phase 4: Setting WSL Service & Delivery Optimization to Manual (On-Demand only)
echo Phase 5: Advanced Responsiveness (Foreground Quantum Boost, Disable Memory Compression)
echo Phase 6: Windows Defender Exclusions for Dev Directories & Dev Tools
echo Phase 7: Disabling Windows 11 Widgets Policy & Telemetry Tasks
echo.
echo ------------------------------------------------------------------------------

powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Furqan\.gemini\antigravity-ide\brain\b62666db-f4e8-4ec0-a41c-a7063558db5d\scratch\elevated_optimizations.ps1"

echo.
echo ==============================================================================
echo                      ALL ADMIN OPTIMIZATIONS COMPLETED!
echo ==============================================================================
echo NOTE: Pagefile and Memory Compression changes will take full effect after reboot.
echo.
pause
