@echo off
REM ================================
REM Atualização rápida de código Git
REM ================================

REM 1) Mostra status atual
echo.
echo ==== GIT STATUS ====
git status
echo.

REM 2) Adiciona todas as mudanças
echo ==== GIT ADD ====
git add .
echo.

REM 3) Commit com mensagem automática por data/hora
set DATETIME=%DATE% %TIME%
git commit -m "fix: ts-safe rowCount -> rows.length (%DATETIME%)"
echo.

REM 4) Push para o branch atual
echo ==== GIT PUSH ====
git push
echo.

echo ✅ Atualização concluída.
pause
