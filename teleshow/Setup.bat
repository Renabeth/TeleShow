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
node --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    @echo Node.js is not installed! Please install Node.js first.
    @exit /b 1
)

:: Install Python dependencies
@echo Installing Python dependencies...
@call pip install -r requirements.txt

:: Install React dependencies
@echo Installing React dependencies...
@cd frontend
@call npm install react-router-dom react-bootstrap axios bootstrap lz-string

@echo ===== Setup complete! =====
@pause