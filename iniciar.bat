@echo off
REM Ir a la carpeta donde está el .bat
cd /d "%~dp0"

REM Activar el entorno virtual
call .\venv\Scripts\activate

REM Ejecutar la app de Flask
flask --app run run

REM Mantener la ventana abierta al terminar
pause
