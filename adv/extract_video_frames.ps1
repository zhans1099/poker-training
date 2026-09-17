param([double[]]$Times = @(0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58))

$ErrorActionPreference='Stop'
$tabs=Invoke-RestMethod 'http://127.0.0.1:9222/json'
$tab=$tabs|Where-Object type -eq 'page'|Select-Object -First 1
$ws=[Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()|Out-Null
$script:seq=0

function Invoke-Cdp([string]$Method,[hashtable]$Params=@{}){
  $id=++$script:seq
  $payload=@{id=$id;method=$Method;params=$Params}|ConvertTo-Json -Compress -Depth 8
  $bytes=[Text.Encoding]::UTF8.GetBytes($payload)
  $ws.SendAsync([ArraySegment[byte]]$bytes,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()|Out-Null
  $buf=New-Object byte[] 1000000
  do{
    $ms=[IO.MemoryStream]::new()
    do{
      $recv=$ws.ReceiveAsync([ArraySegment[byte]]$buf,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $ms.Write($buf,0,$recv.Count)
    }while(-not $recv.EndOfMessage)
    $msg=[Text.Encoding]::UTF8.GetString($ms.ToArray())|ConvertFrom-Json
  }while($msg.id -ne $id)
  $msg.result
}

Invoke-Cdp 'Runtime.evaluate' @{expression='document.querySelector("button[aria-label=Close]")?.click()';returnByValue=$true}|Out-Null
$outDir=Join-Path $PSScriptRoot 'video_7534585503774343184_frames'
New-Item -ItemType Directory -Force -Path $outDir|Out-Null

foreach($time in $Times){
  $expr="(async()=>{const v=document.querySelector('video');v.pause();v.currentTime=$time;await new Promise(r=>{let done=()=>{v.removeEventListener('seeked',done);setTimeout(r,120)};v.addEventListener('seeked',done);setTimeout(done,1500)});return v.getBoundingClientRect().toJSON()})()"
  $res=Invoke-Cdp 'Runtime.evaluate' @{expression=$expr;returnByValue=$true;awaitPromise=$true}
  $rect=$res.result.value
  $shot=Invoke-Cdp 'Page.captureScreenshot' @{format='png';fromSurface=$true;clip=@{x=[double]$rect.x;y=[double]$rect.y;width=[double]$rect.width;height=[double]$rect.height;scale=1}}
  $path=Join-Path $outDir ("frame_{0:00.0}s.png" -f $time)
  [IO.File]::WriteAllBytes($path,[Convert]::FromBase64String($shot.data))
}
$ws.Dispose()
Get-ChildItem -LiteralPath $outDir -Filter '*.png'|Select-Object Name,Length
