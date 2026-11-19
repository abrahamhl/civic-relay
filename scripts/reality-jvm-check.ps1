param([string]$JdkHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
if(-not $JdkHome){throw 'Provide -JdkHome pointing to a JDK17 installation.'}
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compiler=Join-Path $JdkHome 'bin/javac.exe'
$runtime=Join-Path $JdkHome 'bin/java.exe'
$output=Join-Path $repoRoot '.agent-work/reality-jvm'
$main=Join-Path $repoRoot 'experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab'
$tests=Join-Path $repoRoot 'experimental/android-nearby/app/src/test/java/eu/civicrelay/nearbylab'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$sources=Get-ChildItem -LiteralPath $main -Filter 'Lab*.java' | Select-Object -ExpandProperty FullName
$testSources=Get-ChildItem -LiteralPath $tests -Filter '*Test.java' | Select-Object -ExpandProperty FullName
& $compiler --release 17 -d $output @sources @testSources
if($LASTEXITCODE -ne 0){throw 'JVM compilation failed'}
foreach($source in $testSources){
  $class=[IO.Path]::GetFileNameWithoutExtension($source)
  & $runtime -cp $output "eu.civicrelay.nearbylab.$class"
  if($LASTEXITCODE -ne 0){throw "$class failed"}
}
