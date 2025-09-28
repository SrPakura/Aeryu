@echo off
REM Ir a la carpeta donde está este .bat
cd /d "%~dp0"

REM Crear el entorno virtual (si ya existe, no pasa nada)
python -m venv venv
if %errorlevel% neq 0 (
    echo Error al crear el entorno virtual.
    echo Hubo fallos en el proceso
    pause
    exit /b %errorlevel%
)

REM Activar el entorno virtual
call .\venv\Scripts\activate
if %errorlevel% neq 0 (
    echo Error al activar el entorno virtual.
    echo Hubo fallos en el proceso
    pause
    exit /b %errorlevel%
)

REM Instalar dependencias
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Error al instalar dependencias.
    echo Hubo fallos en el proceso
    pause
    exit /b %errorlevel%
)

REM Si todo ha ido bien
echo Instalado correctamente
pause
