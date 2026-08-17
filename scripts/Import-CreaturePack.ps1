[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Source,
    [string]$DisplayName,
    [string]$EnemySlug,
    [string]$PackId,
    [switch]$Yes,
    [switch]$FullValidation,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$WorkflowScript = Join-Path $PSScriptRoot 'creature-pack-workflow.mjs'

function Invoke-WorkflowJson {
    param([string[]]$Arguments)
    $Output = @(& node $WorkflowScript @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw ($Output -join [Environment]::NewLine)
    }
    try {
        if ($Output.Count -gt 1 -and $VerbosePreference -ne 'SilentlyContinue') {
            $Output[0..($Output.Count - 2)] | ForEach-Object { Write-Host $_ }
        }
        return $Output[-1].ToString() | ConvertFrom-Json
    }
    catch {
        throw "Creature workflow returned unreadable output: $($Output -join [Environment]::NewLine)"
    }
}

function Read-DefaultedValue {
    param([string]$Label, [string]$DefaultValue)
    $Value = Read-Host "$Label [$DefaultValue]"
    if ([string]::IsNullOrWhiteSpace($Value)) { return $DefaultValue }
    return $Value.Trim()
}

function Show-Availability {
    param([bool]$Available, [int]$Count = 0)
    if ($Available) {
        if ($Count -gt 0) { return "YES ($Count)" }
        return 'YES'
    }
    return 'NO (explicitly unavailable)'
}

Push-Location $RepositoryRoot
try {
    if ([string]::IsNullOrWhiteSpace($Source)) {
        $Source = Read-Host 'Paste the Forge export DAMAGE folder path'
    }
    $Source = $Source.Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($Source)) { throw 'A Forge export damage folder is required.' }

    $Inspection = Invoke-WorkflowJson @('inspect', '--source', $Source)

    Write-Host ''
    Write-Host '--------------------------------------------------'
    Write-Host 'DREADSTONE CREATURE IMPORT'
    Write-Host ''
    Write-Host 'Source:'
    Write-Host $Inspection.sourceDir
    Write-Host ''
    Write-Host 'Found:'
    Write-Host ("  GLB:        {0}" -f (Split-Path -Leaf $Inspection.files.glb))
    Write-Host ("  Manifest:   {0}" -f (Split-Path -Leaf $Inspection.files.manifest))
    Write-Host ("  Validation: {0}" -f (Split-Path -Leaf $Inspection.files.validationReport))
    if ($Inspection.files.animationManifest) {
        Write-Host ("  Animations: {0}" -f (Split-Path -Leaf $Inspection.files.animationManifest))
    }
    Write-Host ''
    Write-Host ("Forge Status: {0}" -f $Inspection.forgeStatus)
    Write-Host ("Runtime Rig:  {0}" -f $(if ($Inspection.runtimeRig) { $Inspection.runtimeRig } else { 'LEGACY / NOT DECLARED' }))
    Write-Host ("Animations:   {0}" -f $(if ($null -ne $Inspection.animationCount) { $Inspection.animationCount } else { 'embedded; counted during import' }))
    Write-Host ("Sockets:      {0}" -f (Show-Availability $Inspection.socketsAvailable $Inspection.socketCount))
    Write-Host ("Attacks:      {0}" -f (Show-Availability $Inspection.attacksAvailable $Inspection.offensiveActionCount))
    Write-Host '--------------------------------------------------'
    Write-Host ''
    Write-Host 'DISPLAY NAME = human-readable game/debug name.'
    Write-Host 'ENEMY SLUG   = stable lowercase filesystem identity.'
    Write-Host 'PACK ID      = generated technical Creature Pack identity.'
    Write-Host ''

    if ([string]::IsNullOrWhiteSpace($DisplayName)) {
        $DisplayName = if ($Yes) { $Inspection.suggestedDisplayName } else { Read-DefaultedValue 'Display Name' $Inspection.suggestedDisplayName }
    }
    if ([string]::IsNullOrWhiteSpace($EnemySlug)) {
        $EnemySlug = if ($Yes) { $Inspection.suggestedEnemySlug } else { Read-DefaultedValue 'Enemy Slug  ' $Inspection.suggestedEnemySlug }
    }

    $PlanArguments = @(
        'install', '--source', $Source,
        '--display-name', $DisplayName,
        '--enemy-slug', $EnemySlug,
        '--what-if'
    )
    if (-not [string]::IsNullOrWhiteSpace($PackId)) { $PlanArguments += @('--pack-id', $PackId) }
    $Plan = Invoke-WorkflowJson $PlanArguments

    Write-Host ("Pack ID      [{0}] AUTOMATIC" -f $Plan.packId)
    if ($Plan.mode -eq 'UPDATE') {
        Write-Host ''
        Write-Host 'Existing Creature Pack detected:'
        Write-Host $Plan.packId
        Write-Host 'Mode: UPDATE EXISTING CREATURE'
    }
    else {
        Write-Host 'Mode: ADD NEW CREATURE'
    }

    if ($WhatIf) {
        Write-Host ''
        Write-Host 'WHAT IF - no files were copied or generated.'
        Write-Host ("Proposed destination: {0}" -f $Plan.destinationDamage)
        exit 0
    }

    Write-Host ''
    Write-Host 'Staging and validating the Creature Pack...'
    $InstallArguments = @(
        'install', '--source', $Source,
        '--display-name', $DisplayName,
        '--enemy-slug', $EnemySlug
    )
    if (-not [string]::IsNullOrWhiteSpace($PackId)) { $InstallArguments += @('--pack-id', $PackId) }
    if ($FullValidation) { $InstallArguments += '--full-validation' }
    if ($VerbosePreference -ne 'SilentlyContinue') { $InstallArguments += '--verbose' }
    $Result = Invoke-WorkflowJson $InstallArguments

    Write-Host ''
    Write-Host '=================================================='
    Write-Host 'CREATURE IMPORT COMPLETE'
    Write-Host ''
    Write-Host ("Mode:         {0}" -f $(if ($Result.mode -eq 'UPDATE') { 'UPDATE EXISTING CREATURE' } else { 'NEW CREATURE' }))
    Write-Host ("Display Name: {0}" -f $Result.displayName)
    Write-Host ("Enemy Slug:   {0}" -f $Result.enemySlug)
    Write-Host ("Pack ID:      {0}" -f $Result.packId)
    Write-Host ''
    Write-Host 'Installed:'
    Write-Host $Result.installedPath
    Write-Host ''
    Write-Host 'Generated:'
    Write-Host $Result.descriptorPath
    Write-Host ''
    Write-Host 'Creature Lab definition:'
    Write-Host ("{0} ({1})" -f $Result.labDefinitionPath, $Result.labDefinitionStatus)
    Write-Host ''
    Write-Host ("Production catalog:      {0}" -f $Result.catalogStatus)
    Write-Host ("Forge validation:         {0}" -f $Result.forgeStatus)
    Write-Host ("Creature Pack validation: {0}" -f $Result.creaturePackValidation)
    Write-Host ("Sockets:                  {0}" -f (Show-Availability $Result.socketsAvailable $Result.socketCount))
    Write-Host ("Offensive Actions:        {0}" -f $Result.offensiveActionCount)
    Write-Host ''
    Write-Host 'Creature Pack registered successfully.'
    Write-Host 'This makes the technical body available to Dreadstone.'
    Write-Host 'The body is now selectable in Creature Lab after the dev server reloads.'
    Write-Host 'Loadout / Enemy Preset / encounter placement remain separate gameplay steps.'
    Write-Host '=================================================='
}
catch {
    Write-Host ''
    Write-Host '==================================================' -ForegroundColor Red
    Write-Host 'CREATURE IMPORT FAILED' -ForegroundColor Red
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    if ($_.Exception.Message -match 'rollback FAILED') {
        Write-Host 'Automatic rollback needs manual attention. The recovery backup path is shown above.' -ForegroundColor Red
    }
    else {
        Write-Host 'The workflow retained or restored the previous production Creature Pack.'
    }
    Write-Host '==================================================' -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
