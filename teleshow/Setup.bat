@echo About To Install Files for Teleshow

@pause

@echo ===== Setting up development environment =====

:: Check if Python is installed
@python --version > nul 2>&1 ::Redirects to first output to null, redirects 2nd output to where 1 went
@if %ERRORLEVEL% NEQ 0 (
    @echo Python is not installed! Please install Python first.
    @exit /b 1
)

:: Check if Node.js is installed
@node --version > nul 2>&1
@if %ERRORLEVEL% NEQ 0 (
    @echo Node.js is not installed! Please install Node.js first.
    @exit /b 1
)

:: Install Python dependencies
@echo Installing Python dependencies...
@call pip install -r requirements.txt

:: Install React dependencies
@echo Installing React dependencies...
@cd frontend
@call npm install react-router-dom react-router react-bootstrap axios bootstrap lz-string axios-retry react-icons firebase-admin

@call npm install --save-dev concurrently dotenv

:: Return to root directory
@cd ..

:: Create empty .env files if they don't exist
@echo Checking and creating .env files if needed...

@echo off
if exist "backend\.env" (
    @echo Using .env file from backend folder.
) else if exist ".env" (
    @echo Using .env file from root folder.
) else (
    @echo No .env file found in backend folder or root directory.
    @echo Creating empty .env file in backend folder...
    @type nul > backend\.env
)

@if not exist frontend\.env (
  @echo Creating empty .env file in frontend folder...
  @type nul > frontend\.env
) else (
  @echo Frontend .env file already exists.
)

:: Create Resources directory if it doesn't exist
@if not exist backend\Resources (
  @echo Creating Resources directory...
  @mkdir backend\Resources
)

:: Create empty JSON file if it doesn't exist
@echo Checking and creating Resource file if needed...

@if not exist backend\Resources\teleshow-firebase.json (
  @echo Creating empty JSON file in Resources folder...
  @echo {} > backend\Resources\teleshow-firebase.json
) else (
  @echo Resource JSON file already exists.
)

@echo ===== Setup complete! =====
@pause