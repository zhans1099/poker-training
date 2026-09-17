param(
  [string]$Url = 'https://ads.tiktok.com/business/creativecenter/topads/7534585503774343184',
  [double[]]$Times = @(0,2,6,11)
)

$ErrorActionPreference = 'Stop'
$tabs = Invoke-RestMethod 'http://127.0.0.1:9222/json'
$tab = $tabs | Where-Object type -eq 'page' | Select-Object -First 1
$ws = [Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
$script:seq = 0

function Invoke-Cdp([string]$Method,[hashtable]$Params=@{}) {
  $id = ++$script:seq
  $payload = @{id=$id;method=$Method;params=$Params} | ConvertTo-Json -Compress -Depth 8
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $ws.SendAsync([ArraySegment[byte]]$bytes,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  $buf = New-Object byte[] 600000
  do {
    $ms = [IO.MemoryStream]::new()
    do {
      $recv = $ws.ReceiveAsync([ArraySegment[byte]]$buf,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $ms.Write($buf,0,$recv.Count)
    } while(-not $recv.EndOfMessage)
    $msg = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
  } while($msg.id -ne $id)
  return $msg.result
}

Invoke-Cdp 'Page.navigate' @{url=$Url} | Out-Null
Start-Sleep -Seconds 5
Invoke-Cdp 'Runtime.evaluate' @{expression='document.querySelector("button[aria-label=Close]")?.click()';returnByValue=$true} | Out-Null
Start-Sleep -Seconds 1
Invoke-Cdp 'Runtime.evaluate' @{expression='document.querySelector("video")?.scrollIntoView({block:"center"})';returnByValue=$true} | Out-Null
Start-Sleep -Seconds 1

$outDir = Join-Path $PSScriptRoot 'frames'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
foreach($time in $Times) {
  $expr = "(async()=>{const v=document.querySelector('video');if(!v)return null;v.muted=true;await v.play().catch(()=>{});v.currentTime=$time;await new Promise(r=>{if(v.readyState>=2)setTimeout(r,500);else v.addEventListener('loadeddata',()=>r(),{once:true})});v.pause();return {duration:v.duration,currentTime:v.currentTime,readyState:v.readyState,rect:v.getBoundingClientRect().toJSON()}})()"
  Invoke-Cdp 'Runtime.evaluate' @{expression=$expr;returnByValue=$true;awaitPromise=$true} | Out-Null
  Start-Sleep -Milliseconds 1200
  $shot = Invoke-Cdp 'Page.captureScreenshot' @{format='png';fromSurface=$true}
  $path = Join-Path $outDir ("frame_{0:00.0}s.png" -f $time)
  [IO.File]::WriteAllBytes($path,[Convert]::FromBase64String($shot.data))
  $path
}
$ws.Dispose()
